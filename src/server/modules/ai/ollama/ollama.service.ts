/* Core Dependencies */
import {Injectable} from '@nestjs/common';
import {Readable} from 'stream';
import {randomUUID} from 'crypto';
/* Application Dependencies */
import {FetchService} from '#server/modules/fetch/fetch.service';
import {SettingService} from '#server/modules/setting/setting.service';
import {SettingKey} from '#server/modules/setting/setting.enums';
/* Local Dependencies */
import type {AiVendor} from '../ai.vendor.js';
import type {AiModel, AiMessage, AiTool, AiStreamChunk} from '../ai.types.js';
import {AiMessageRole} from '../ai.enums.js';
import type {OllamaTagsResponse, OllamaChatChunk, OllamaModel} from './ollama.types.js';

@Injectable()
export class OllamaService implements AiVendor {
	constructor(
		private fetchService: FetchService,
		private settingService: SettingService,
	) {}

	/**
	 * Resolve the Ollama base URL from settings
	 * @returns {Promise<string>} The base URL for Ollama API calls
	 */
	private async getBaseUrl(): Promise<string> {
		const base_url = await this.settingService.getStringSetting(SettingKey.AI_OLLAMA_API);
		if (!base_url) throw new Error('Ollama API endpoint is not configured');
		return base_url;
	}

	/**
	 * Fetch available models from Ollama
	 * @returns {Promise<AiModel[]>} Normalized model list
	 */
	async getModels(): Promise<AiModel[]> {
		const base_url = await this.getBaseUrl();
		const response = await this.fetchService.fetchWithProxy(`${base_url}/api/tags`, {
			method: 'GET',
			headers: {'Content-Type': 'application/json'},
		});
		if (!response.ok) {
			const error_text = await response.text();
			throw new Error(`Ollama returned status ${response.status}: ${error_text}`);
		}
		const data = (await response.json()) as OllamaTagsResponse;
		return data.models.map((m) => this.mapModel(m));
	}

	/**
	 * Stream a chat completion from Ollama
	 * @param {string} model - Model identifier
	 * @param {AiMessage[]} messages - Conversation messages
	 * @param {AiTool[]} tools - Tool definitions
	 * @param {AbortSignal} [signal] - Optional abort signal
	 * @yields {AiStreamChunk} Typed stream chunks
	 */
	async *streamChat(model: string, messages: AiMessage[], tools: AiTool[], signal?: AbortSignal): AsyncGenerator<AiStreamChunk> {
		const base_url = await this.getBaseUrl();
		const response = await this.fetchService.fetchWithProxy(`${base_url}/api/chat`, {
			method: 'POST',
			headers: {'Content-Type': 'application/json'},
			body: JSON.stringify({model, messages, tools, stream: true}),
			signal,
		});

		if (!response.ok) {
			const error_text = await response.text();
			throw new Error(`Ollama returned status ${response.status}: ${error_text}`);
		}

		const node_stream = response.body as Readable;
		const web_stream = Readable.toWeb(node_stream) as ReadableStream<Uint8Array>;
		const reader = web_stream.getReader();
		const decoder = new TextDecoder();
		let buffer = '';

		try {
			while (true) {
				const {done, value} = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, {stream: true});
				const lines = buffer.split('\n');
				buffer = lines.pop() ?? '';

				for (const line of lines) {
					const trimmed = line.trim();
					if (!trimmed) continue;

					try {
						const chunk: OllamaChatChunk = JSON.parse(trimmed);
						yield this.mapChunk(chunk);
					} catch {
						/* Skip unparseable lines */
					}
				}
			}

			if (buffer.trim()) {
				try {
					const chunk: OllamaChatChunk = JSON.parse(buffer.trim());
					yield this.mapChunk(chunk);
				} catch {
					/* Skip unparseable lines */
				}
			}
		} finally {
			reader.releaseLock();
		}
	}

	/**
	 * Map an Ollama model to the normalized AiModel shape
	 * @param {OllamaModel} m - Raw Ollama model
	 * @returns {AiModel} Normalized model
	 */
	private mapModel(m: OllamaModel): AiModel {
		return {
			model: m.model,
			name: m.name,
			context_length: 0,
			ollama: {
				modified_at: m.modified_at,
				size: m.size,
				digest: m.digest,
				parent_model: m.details.parent_model,
				format: m.details.format,
				family: m.details.family,
				families: m.details.families ?? [],
				parameter_size: m.details.parameter_size,
				quantization_level: m.details.quantization_level,
			},
		};
	}

	/**
	 * Map an Ollama chat chunk to the normalized AiStreamChunk shape
	 * @param {OllamaChatChunk} chunk - Raw Ollama chunk
	 * @returns {AiStreamChunk} Normalized stream chunk
	 */
	private mapChunk(chunk: OllamaChatChunk): AiStreamChunk {
		const stream_chunk: AiStreamChunk = {
			model: chunk.model,
			created_at: chunk.created_at,
			message: {
				role: chunk.message.role as AiMessageRole,
				content: chunk.message.content,
				thinking: chunk.message.thinking,
				tool_calls: chunk.message.tool_calls?.map((tc) => ({
					id: randomUUID(),
					function: {
						name: tc.function.name,
						arguments: tc.function.arguments,
					},
				})),
			},
			done: chunk.done,
			done_reason: chunk.done_reason,
			error: chunk.error,
		};

		if (chunk.done) {
			stream_chunk.usage = {
				prompt_tokens: chunk.prompt_eval_count,
				completion_tokens: chunk.eval_count,
				total_duration: chunk.total_duration,
				eval_duration: chunk.eval_duration,
			};
		}

		return stream_chunk;
	}
}
