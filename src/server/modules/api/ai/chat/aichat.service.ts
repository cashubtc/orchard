/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Vendor Dependencies */
import {EventEmitter} from 'events';
import {DateTime} from 'luxon';
/* Application Dependencies */
import {AiService} from '#server/modules/ai/ai.service';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {AiMessageRole} from '#server/modules/ai/ai.enums';
import type {AiStreamChunk} from '#server/modules/ai/ai.types';
/* Local Dependencies */
import {OrchardAiChatChunk, OrchardAiChatStream} from './aichat.model.js';
import {AiChatInput} from './aichat.input.js';

@Injectable()
export class AiChatService {
	private readonly logger = new Logger(AiChatService.name);
	private event_emitter = new EventEmitter();
	private active_streams: Map<string, AbortController> = new Map();

	constructor(
		private aiService: AiService,
		private errorService: ErrorService,
	) {}

	public async streamChat(tag: string, ai_chat: AiChatInput) {
		try {
			const controller = new AbortController();
			this.active_streams.set(ai_chat.id, controller);
			const signal = controller.signal;
			const chunks = this.aiService.streamAssistant(ai_chat.model, ai_chat.assistant, ai_chat.messages, signal);

			for await (const chunk of chunks) {
				const chunk_data = chunk.error ? this.getChunkErrorJSON(chunk.error) : chunk;
				this.event_emitter.emit('ai.chat.update', new OrchardAiChatChunk(chunk_data, ai_chat.id));
			}

			this.active_streams.delete(ai_chat.id);
			return true;
		} catch (error) {
			this.active_streams.delete(ai_chat.id);
			const is_timeout = error instanceof DOMException && error.name === 'TimeoutError';
			if (is_timeout) {
				this.logger.warn(`Chat stream ${ai_chat.id} aborted: idle timeout (${error.message})`);
				this.event_emitter.emit(
					'ai.chat.update',
					new OrchardAiChatChunk(this.getChunkErrorJSON('Response timed out — no data received from model'), ai_chat.id),
				);
				return false;
			}
			if (error.name === 'AbortError' || error.type === 'aborted') {
				this.logger.debug(`Chat stream ${ai_chat.id} aborted by user`);
				return false;
			}
			this.logger.debug(`Error streaming chat`, error);
			this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.AiError,
			});
			const error_message = error instanceof Error ? error.message : 'An unknown error occurred';
			this.event_emitter.emit('ai.chat.update', new OrchardAiChatChunk(this.getChunkErrorJSON(error_message), ai_chat.id));
		}
	}

	public onChatUpdate(callback: (chat_chunk: OrchardAiChatChunk) => void): void {
		this.event_emitter.on('ai.chat.update', callback);
	}

	public abortStream(id: string): OrchardAiChatStream {
		const controller = this.active_streams.get(id);
		if (!controller) throw new OrchardApiError(OrchardErrorCode.AiStreamError);
		controller.abort();
		this.active_streams.delete(id);
		return {id};
	}

	private getChunkErrorJSON(error: string): AiStreamChunk {
		return {
			model: 'error',
			created_at: DateTime.now().toISO(),
			message: {
				role: AiMessageRole.ERROR,
				content: error,
			},
			done: true,
		};
	}
}
