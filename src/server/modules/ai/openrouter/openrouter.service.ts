/* Core Dependencies */
import {Injectable} from '@nestjs/common';
import {Readable} from 'stream';
/* Application Dependencies */
import {FetchService} from '#server/modules/fetch/fetch.service';
import {SettingService} from '#server/modules/setting/setting.service';
import {SettingKey} from '#server/modules/setting/setting.enums';
import {safeParse} from '#server/modules/utilities/index';
/* Local Dependencies */
import {AiVendor} from '../ai.vendor.js';
import {AiModel, AiMessage, AiTool, AiStreamChunk, AiToolCall} from '../ai.types.js';
import {AiMessageRole} from '../ai.enums.js';
import {OpenRouterModelsResponse, OpenRouterModel, OpenRouterChatChunk, OpenRouterToolCallDelta} from './openrouter.types.js';

@Injectable()
export class OpenRouterService implements AiVendor {
	private readonly base_url = 'https://openrouter.ai/api/v1';

	constructor(
		private fetchService: FetchService,
		private settingService: SettingService,
	) {}

	/**
	 * Get the OpenRouter API key from settings
	 * @returns {Promise<string>} The API key
	 */
	private async getApiKey(): Promise<string> {
		const api_key = await this.settingService.getStringSetting(SettingKey.AI_OPENROUTER_KEY);
		if (!api_key) throw new Error('OpenRouter API key is not configured');
		return api_key;
	}

	/**
	 * Build authorization headers for OpenRouter requests
	 * @returns {Promise<Record<string, string>>} Headers with auth
	 */
	private async getHeaders(): Promise<Record<string, string>> {
		const api_key = await this.getApiKey();
		return {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${api_key}`,
		};
	}

	/**
	 * Fetch available models from OpenRouter
	 * @returns {Promise<AiModel[]>} Normalized model list
	 */
	async getModels(): Promise<AiModel[]> {
		const headers = await this.getHeaders();
		const response = await this.fetchService.fetchWithProxy(`${this.base_url}/models`, {
			method: 'GET',
			headers,
		});

		if (!response.ok) {
			throw new Error(`OpenRouter returned status ${response.status}`);
		}

		const data: OpenRouterModelsResponse = await response.json();
		return data.data.map((m) => this.mapModel(m));
	}

	/**
	 * Stream a chat completion from OpenRouter
	 * @param {string} model - Model identifier (e.g., "anthropic/claude-3.5-sonnet")
	 * @param {AiMessage[]} messages - Conversation messages
	 * @param {AiTool[]} tools - Tool definitions
	 * @param {AbortSignal} [signal] - Optional abort signal
	 * @yields {AiStreamChunk} Typed stream chunks
	 */
	async *streamChat(model: string, messages: AiMessage[], tools: AiTool[], signal?: AbortSignal): AsyncGenerator<AiStreamChunk> {
		const headers = await this.getHeaders();

		const openai_messages = messages.map((m) => {
			/* Assistant messages with tool calls need the full tool_calls array */
			if (m.role === AiMessageRole.ASSISTANT && m.tool_calls?.length) {
				return {
					role: m.role,
					content: m.content || null,
					tool_calls: m.tool_calls.map((tc) => ({
						id: tc.id,
						type: 'function' as const,
						function: {
							name: tc.function.name,
							arguments: JSON.stringify(tc.function.arguments),
						},
					})),
				};
			}
			/* Tool result messages need tool_call_id */
			if (m.role === AiMessageRole.TOOL) {
				return {
					role: m.role,
					tool_call_id: m.tool_call_id,
					content: m.content,
				};
			}
			return {
				role: m.role,
				content: m.content,
			};
		});

		const body: Record<string, unknown> = {
			model,
			messages: openai_messages,
			stream: true,
		};

		if (tools.length > 0) {
			body.tools = tools;
		}

		const response = await this.fetchService.fetchWithProxy(`${this.base_url}/chat/completions`, {
			method: 'POST',
			headers,
			body: JSON.stringify(body),
			signal,
		});

		if (!response.ok) {
			const error_text = await response.text();
			throw new Error(`OpenRouter returned status ${response.status}: ${error_text}`);
		}

		const node_stream = response.body as Readable;
		const web_stream = Readable.toWeb(node_stream) as ReadableStream<Uint8Array>;

		yield* this.parseSSEStream(web_stream, model);
	}

	/**
	 * Parse an SSE stream from OpenRouter and yield normalized AiStreamChunks.
	 * Handles: content deltas, tool call accumulation, keepalive comments, [DONE] signal.
	 * @param {ReadableStream<Uint8Array>} stream - The raw SSE byte stream
	 * @param {string} model - Fallback model name
	 * @yields {AiStreamChunk} Typed stream chunks
	 */
	private async *parseSSEStream(stream: ReadableStream<Uint8Array>, model: string): AsyncGenerator<AiStreamChunk> {
		const reader = stream.getReader();
		const decoder = new TextDecoder();
		let buffer = '';
		const tool_calls_acc = new Map<number, {id: string; name: string; arguments: string}>();
		let last_usage: {prompt_tokens?: number; completion_tokens?: number} | undefined;

		try {
			while (true) {
				const {done, value} = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, {stream: true});
				const lines = buffer.split('\n');
				buffer = lines.pop() ?? '';

				for (const line of lines) {
					const trimmed = line.trim();

					/* Skip empty lines and keepalive comments */
					if (!trimmed || trimmed.startsWith(':')) continue;

					/* Must start with "data: " */
					if (!trimmed.startsWith('data: ')) continue;

					const payload = trimmed.slice(6);

					/* Stream end signal */
					if (payload === '[DONE]') {
						yield this.buildDoneChunk(model, tool_calls_acc, last_usage);
						tool_calls_acc.clear();
						continue;
					}

					try {
						const sse_data: OpenRouterChatChunk = JSON.parse(payload);
						const choice = sse_data.choices?.[0];
						if (!choice) continue;

						/* Track usage if provided */
						if (sse_data.usage) {
							last_usage = {
								prompt_tokens: sse_data.usage.prompt_tokens,
								completion_tokens: sse_data.usage.completion_tokens,
							};
						}

						/* Accumulate tool call deltas */
						if (choice.delta?.tool_calls) {
							this.accumulateToolCalls(choice.delta.tool_calls, tool_calls_acc);
						}

						/* Yield content delta chunk */
						yield {
							model: sse_data.model || model,
							created_at: new Date(sse_data.created * 1000).toISOString(),
							message: {
								role: (choice.delta?.role || 'assistant') as AiMessageRole,
								content: choice.delta?.content ?? '',
							},
							done: false,
						};
					} catch {
						/* Skip unparseable lines */
					}
				}
			}
		} finally {
			reader.releaseLock();
		}
	}

	/**
	 * Accumulate tool call fragments across SSE deltas
	 * @param {OpenRouterToolCallDelta[]} deltas - Tool call delta fragments
	 * @param {Map<number, {id: string; name: string; arguments: string}>} acc - Accumulator map keyed by tool call index
	 */
	private accumulateToolCalls(deltas: OpenRouterToolCallDelta[], acc: Map<number, {id: string; name: string; arguments: string}>): void {
		for (const delta of deltas) {
			const existing = acc.get(delta.index) ?? {id: '', name: '', arguments: ''};
			if (delta.id) existing.id = delta.id;
			if (delta.function?.name) existing.name = delta.function.name;
			if (delta.function?.arguments) existing.arguments += delta.function.arguments;
			acc.set(delta.index, existing);
		}
	}

	/**
	 * Build the final done chunk with accumulated tool calls and usage
	 * @param {string} model - Model identifier
	 * @param {Map<number, {id: string; name: string; arguments: string}>} tool_calls_acc - Accumulated tool calls
	 * @param {{prompt_tokens?: number; completion_tokens?: number}} [usage] - Token usage data
	 * @returns {AiStreamChunk} The final done chunk
	 */
	private buildDoneChunk(
		model: string,
		tool_calls_acc: Map<number, {id: string; name: string; arguments: string}>,
		usage?: {prompt_tokens?: number; completion_tokens?: number},
	): AiStreamChunk {
		let tool_calls: AiToolCall[] | undefined;

		if (tool_calls_acc.size > 0) {
			tool_calls = Array.from(tool_calls_acc.values()).map((tc) => ({
				id: tc.id,
				function: {
					name: tc.name,
					arguments: safeParse(tc.arguments || '{}', {}, 'openrouter.tool_call.arguments'),
				},
			}));
		}

		return {
			model,
			created_at: new Date().toISOString(),
			message: {
				role: AiMessageRole.ASSISTANT,
				content: '',
				...(tool_calls ? {tool_calls} : {}),
			},
			done: true,
			done_reason: 'stop',
			usage: usage
				? {
						prompt_tokens: usage.prompt_tokens,
						completion_tokens: usage.completion_tokens,
					}
				: undefined,
		};
	}

	/**
	 * Map an OpenRouter model to the normalized AiModel shape
	 * @param {OpenRouterModel} m - Raw OpenRouter model
	 * @returns {AiModel} Normalized model
	 */
	private mapModel(m: OpenRouterModel): AiModel {
		const family = m.id.split('/')[0] ?? '';
		return {
			model: m.id,
			name: m.name,
			context_length: m.context_length,
			openrouter: {
				pricing_prompt: m.pricing?.prompt ?? '0',
				pricing_completion: m.pricing?.completion ?? '0',
				modality: m.architecture?.modality ?? '',
				tokenizer: m.architecture?.tokenizer ?? '',
				max_completion_tokens: m.top_provider?.max_completion_tokens ?? 0,
				family,
			},
		};
	}
}
