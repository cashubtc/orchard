/* Core Dependencies */
import {Logger, OnModuleInit} from '@nestjs/common';
import {Resolver, Subscription, Args, Mutation} from '@nestjs/graphql';
/* Vendor Dependencies */
import {PubSub} from 'graphql-subscriptions';
/* Local Dependencies */
import {AiChatService} from './aichat.service.js';
import {OrchardAiChatChunk, OrchardAiChatStream} from './aichat.model.js';
import {AiChatInput} from './aichat.input.js';

const pubSub = new PubSub();

@Resolver(() => OrchardAiChatChunk)
export class AiChatResolver implements OnModuleInit {
	private readonly logger = new Logger(AiChatResolver.name);

	constructor(private aiChatService: AiChatService) {}

	onModuleInit() {
		if (process.env.SCHEMA_ONLY) return;
		this.aiChatService.onChatUpdate((chat_chunk: OrchardAiChatChunk) => {
			pubSub.publish('ai_chat', {ai_chat: chat_chunk});
		});
	}

	@Subscription(() => OrchardAiChatChunk, {
		description: 'Subscribe to AI chat streaming chunks',
		filter: (payload: {ai_chat: OrchardAiChatChunk}, variables: {ai_chat: AiChatInput}) => payload.ai_chat.id === variables.ai_chat.id,
	})
	async ai_chat(@Args('ai_chat', {description: 'Chat input with model and messages'}) ai_chat: AiChatInput) {
		const tag = `SUBSCRIPTION { ai_chat } for stream ${ai_chat.id}`;
		this.logger.debug(tag);
		this.aiChatService.streamChat(tag, ai_chat);
		return pubSub.asyncIterableIterator('ai_chat');
	}

	@Mutation(() => OrchardAiChatStream, {description: 'Abort an active AI chat stream'})
	async ai_chat_abort(
		@Args('id', {type: () => String, description: 'Stream identifier to abort'}) id: string,
	): Promise<OrchardAiChatStream> {
		const tag = `MUTATION { ai_chat_abort } for stream ${id}`;
		this.logger.debug(tag);
		return this.aiChatService.abortStream(id);
	}
}
