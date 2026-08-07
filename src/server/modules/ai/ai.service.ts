/* Core Dependencies */
import {Injectable} from '@nestjs/common';
/* Application Dependencies */
import {SettingService} from '#server/modules/setting/setting.service';
import {SettingKey} from '#server/modules/setting/setting.enums';
/* Local Dependencies */
import {AiModel, AiMessage, AiTool, AiStreamChunk} from './ai.types.js';
import {AiVendor} from './ai.vendor.js';
import {OllamaService} from './ollama/ollama.service.js';
import {OpenRouterService} from './openrouter/openrouter.service.js';
import {AI_ASSISTANTS} from './assistant/ai.assistants.js';
import {AiAssistant} from './assistant/ai.assistant.enums.js';

@Injectable()
export class AiService {
	private assistant_idle_timeout: number = 120000;
	private agent_idle_timeout: number = 300000;

	constructor(
		private settingService: SettingService,
		private ollamaService: OllamaService,
		private openRouterService: OpenRouterService,
	) {}

	/**
	 * Resolve the vendor service based on the AI_VENDOR setting
	 * @returns {Promise<AiVendor>} The appropriate vendor service
	 */
	private async getVendor(): Promise<AiVendor> {
		const vendor = await this.settingService.getStringSetting(SettingKey.AI_VENDOR);
		if (vendor === 'openrouter') return this.openRouterService;
		return this.ollamaService;
	}

	/**
	 * Fetch available models from the configured vendor
	 * @returns {Promise<AiModel[]>} List of available models
	 */
	async getModels(): Promise<AiModel[]> {
		const vendor = await this.getVendor();
		return vendor.getModels();
	}

	/**
	 * Stream a chat completion for agent execution.
	 * Uses a longer timeout suitable for multi-step tool-calling loops.
	 * @param {string} model - The model identifier to use
	 * @param {AiMessage[]} messages - Full message array (including system message)
	 * @param {AiTool[]} tools - Tool definitions for function calling
	 * @param {AbortSignal} [signal] - Optional abort signal
	 * @returns {AsyncGenerator<AiStreamChunk>} Typed stream chunks
	 */
	async *streamAgent(model: string, messages: AiMessage[], tools: AiTool[], signal?: AbortSignal): AsyncGenerator<AiStreamChunk> {
		const vendor = await this.getVendor();
		yield* this.streamWithIdleTimeout(vendor, model, messages, tools, this.agent_idle_timeout, signal);
	}

	/**
	 * Stream a chat completion for assistant chat.
	 * Resolves tools and system message from the assistant registry.
	 * @param {string} model - The model identifier to use
	 * @param {AiAssistant | null} assistant - The assistant preset (defaults to DEFAULT)
	 * @param {AiMessage[]} messages - The conversation messages
	 * @param {AbortSignal} [signal] - Optional abort signal
	 * @returns {AsyncGenerator<AiStreamChunk>} Typed stream chunks
	 */
	async *streamAssistant(
		model: string,
		assistant: AiAssistant | null,
		messages: AiMessage[],
		signal?: AbortSignal,
	): AsyncGenerator<AiStreamChunk> {
		if (!assistant) assistant = AiAssistant.DEFAULT;
		const tools = AI_ASSISTANTS[assistant].tools;
		const system_message = AI_ASSISTANTS[assistant].system_message;

		const vendor = await this.getVendor();
		yield* this.streamWithIdleTimeout(
			vendor,
			model,
			[system_message as AiMessage, ...messages],
			tools,
			this.assistant_idle_timeout,
			signal,
		);
	}

	/**
	 * Wrap a vendor stream with an idle (inter-chunk) timeout.
	 * The timer is reset every time a chunk arrives, so long-running streams
	 * are only aborted when the upstream genuinely stalls. The caller's abort
	 * signal is forwarded, and idle expiry aborts with a DOMException whose
	 * name is 'TimeoutError' so consumers can distinguish it from a user abort.
	 * @param {AiVendor} vendor - The vendor to stream from
	 * @param {string} model - The model identifier
	 * @param {AiMessage[]} messages - The messages to send
	 * @param {AiTool[]} tools - Tool definitions
	 * @param {number} idle_ms - Max ms allowed between chunks
	 * @param {AbortSignal} [caller_signal] - Optional caller abort signal
	 * @returns {AsyncGenerator<AiStreamChunk>} Typed stream chunks
	 */
	private async *streamWithIdleTimeout(
		vendor: AiVendor,
		model: string,
		messages: AiMessage[],
		tools: AiTool[],
		idle_ms: number,
		caller_signal?: AbortSignal,
	): AsyncGenerator<AiStreamChunk> {
		const idle_controller = new AbortController();
		let handle: NodeJS.Timeout | undefined;
		const reset = () => {
			if (handle) clearTimeout(handle);
			handle = setTimeout(() => {
				idle_controller.abort(new DOMException(`No chunks received for ${idle_ms}ms`, 'TimeoutError'));
			}, idle_ms);
		};
		const onCallerAbort = () => idle_controller.abort(caller_signal?.reason ?? new DOMException('Aborted', 'AbortError'));
		if (caller_signal) {
			if (caller_signal.aborted) idle_controller.abort(caller_signal.reason ?? new DOMException('Aborted', 'AbortError'));
			else caller_signal.addEventListener('abort', onCallerAbort, {once: true});
		}
		try {
			reset();
			for await (const chunk of vendor.streamChat(model, messages, tools, idle_controller.signal)) {
				reset();
				yield chunk;
			}
		} catch (error) {
			// Fetch surfaces signal-driven aborts as a generic AbortError without the signal's
			// reason. If our idle timer was the trigger (caller did not cancel), re-throw the
			// timer's reason so consumers can distinguish a timeout from a user abort.
			if (idle_controller.signal.aborted && !caller_signal?.aborted && idle_controller.signal.reason instanceof DOMException) {
				throw idle_controller.signal.reason;
			}
			throw error;
		} finally {
			if (handle) clearTimeout(handle);
			if (caller_signal) caller_signal.removeEventListener('abort', onCallerAbort);
		}
	}
}
