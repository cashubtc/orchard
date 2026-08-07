/* Local Dependencies */
import {AiModel, AiMessage, AiTool, AiStreamChunk} from './ai.types.js';

/**
 * Common interface for AI vendor implementations.
 * Each vendor service must implement this contract.
 */
export interface AiVendor {
	/**
	 * Fetch available models from the vendor
	 * @returns {Promise<AiModel[]>} Normalized model list
	 */
	getModels(): Promise<AiModel[]>;

	/**
	 * Stream a chat completion as typed objects
	 * @param {string} model - Model identifier
	 * @param {AiMessage[]} messages - Conversation messages (system + user)
	 * @param {AiTool[]} tools - Tool definitions for function calling
	 * @param {AbortSignal} [signal] - Optional abort signal
	 * @returns {AsyncGenerator<AiStreamChunk>} Typed stream chunks
	 */
	streamChat(model: string, messages: AiMessage[], tools: AiTool[], signal?: AbortSignal): AsyncGenerator<AiStreamChunk>;
}
