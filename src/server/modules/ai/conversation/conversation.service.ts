/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
/* Vendor Dependencies */
import {Repository} from 'typeorm';
import {DateTime} from 'luxon';
import {OnEvent} from '@nestjs/event-emitter';
/* Application Dependencies */
import {AgentService} from '#server/modules/ai/agent/agent.service';
import {AgentRunStatus} from '#server/modules/ai/agent/agent.enums';
import {Agent} from '#server/modules/ai/agent/agent.entity';
import {AgentKey} from '#server/modules/ai/agent/agent.enums';
import {AiMessage} from '#server/modules/ai/ai.types';
import {AiMessageRole} from '#server/modules/ai/ai.enums';
import {AiAgentContext} from '#server/modules/ai/tools/tool.types';
import {MessageService} from '#server/modules/message/message.service';
import {safeParse} from '#server/modules/utilities/index';
import {
	MESSAGE_INCOMING_EVENT,
	MESSAGE_RESET_EVENT,
	IncomingMessagePayload,
	ResetMessagePayload,
} from '#server/modules/message/message.types';
/* Local Dependencies */
import {Conversation} from './conversation.entity.js';
import {ConversationStatus} from './conversation.enums.js';

@Injectable()
export class ConversationService {
	private readonly logger = new Logger(ConversationService.name);

	private static readonly IDLE_TIMEOUT_SECONDS = 3600;
	private static readonly MAX_MESSAGES = 50;
	private static readonly COMPRESS_THRESHOLD = 500;

	/** Active abort controllers keyed by chat_id — one per chat at most */
	private active_runs = new Map<string, AbortController>();

	constructor(
		@InjectRepository(Conversation)
		private conversationRepository: Repository<Conversation>,
		private agentService: AgentService,
		private messageService: MessageService,
	) {}

	/* *******************************************************
		Event Handlers
	******************************************************** */

	/** Handle an incoming user message: abort any in-flight run, persist the message, then run agent */
	@OnEvent(MESSAGE_INCOMING_EVENT)
	public async handleIncomingMessage(payload: IncomingMessagePayload): Promise<void> {
		const {chat_id, user_id, text} = payload;

		const agent = await this.agentService.getAgentByKey(AgentKey.GROUNDSKEEPER);
		if (!agent) {
			this.logger.warn('GROUNDSKEEPER agent not found — cannot start conversation');
			return;
		}

		/* Abort any in-flight agent run for this chat */
		this.active_runs.get(chat_id)?.abort();

		let conversation = await this.getActiveConversation(chat_id);
		if (!conversation) {
			conversation = await this.createConversation(agent, user_id, chat_id);
		}

		/* Persist the user message immediately so it is never lost */
		const messages: AiMessage[] = safeParse(conversation.messages, [], `conversation.messages[${conversation.id}]`);
		this.compressPreviousTurns(messages);
		messages.push({role: AiMessageRole.USER, content: text});

		const now = DateTime.utc().toUnixInteger();
		await this.conversationRepository.update(conversation.id, {
			messages: JSON.stringify(messages),
			last_activity_at: now,
		});

		/* Send a thinking indicator */
		const thinking = await this.messageService.sendReply(chat_id, '...');

		/* Create an abort controller for this run */
		const controller = new AbortController();
		this.active_runs.set(chat_id, controller);

		const tool_names = this.agentService.resolveToolNames(agent);
		const resolved_name = this.agentService.resolveName(agent);
		const agent_context: AiAgentContext = {agent_id: agent.id, agent_name: resolved_name};

		try {
			this.logger.log(`Agent ${resolved_name} conversation started (chat: ${chat_id})`);
			if (!agent.model) throw new Error(`Agent "${resolved_name}" has no model configured`);
			const loop_result = await this.agentService.runToolLoop({
				model: agent.model,
				messages,
				tool_names,
				agent_context,
				signal: controller.signal,
			});

			/* If aborted mid-run, persist token usage and exit — the new invocation handles the response */
			if (controller.signal.aborted) {
				this.logger.log(`Agent ${resolved_name} conversation aborted (chat: ${chat_id})`);
				if (loop_result.tokens_used > 0) {
					await this.conversationRepository.update(conversation.id, {
						tokens_used: conversation.tokens_used + loop_result.tokens_used,
					});
				}
				return;
			}

			this.logger.log(`Agent ${resolved_name} conversation completed (tokens: ${loop_result.tokens_used})`);
			this.truncateHistory(loop_result.messages);

			const completed_at = DateTime.utc().toUnixInteger();
			await this.conversationRepository.update(conversation.id, {
				messages: JSON.stringify(loop_result.messages),
				tokens_used: conversation.tokens_used + loop_result.tokens_used,
				last_activity_at: completed_at,
			});

			await this.replyOrEdit(chat_id, thinking, loop_result.result);
		} catch (error) {
			if (controller.signal.aborted) return;
			this.logger.error(`Agent ${resolved_name} conversation failed (chat: ${chat_id})`, error);
			await this.replyOrEdit(chat_id, thinking, 'Something went wrong processing your message.');
		} finally {
			/* Clean up only if this controller is still the active one */
			if (this.active_runs.get(chat_id) === controller) {
				this.active_runs.delete(chat_id);
			}
		}
	}

	/** Handle a /new command: expire the active conversation and confirm */
	@OnEvent(MESSAGE_RESET_EVENT)
	public async handleReset(payload: ResetMessagePayload): Promise<void> {
		const {chat_id} = payload;

		const conversation = await this.getActiveConversation(chat_id);
		if (conversation) {
			await this.expireConversation(conversation.id);
			this.logger.log(`Conversation reset for chat ${chat_id}`);
		}

		await this.messageService.sendReply(chat_id, 'Conversation reset. Send a message to start fresh.');
	}

	/** Edit the thinking message with the final text, or send a new message if no message_id is available */
	private async replyOrEdit(chat_id: string, thinking: {message_id?: number}, text: string): Promise<void> {
		if (thinking.message_id) {
			await this.messageService.editReply(chat_id, thinking.message_id, text);
		} else {
			await this.messageService.sendReply(chat_id, text);
		}
	}

	/* *******************************************************
		Context Management
	******************************************************** */

	/**
	 * Blank out large tool results older than the previous turn to save tokens.
	 * Destructive: rewrites the array that gets persisted AND sent to the model, so
	 * agents can't recall compressed results — they must re-call the tool.
	 */
	private compressPreviousTurns(messages: AiMessage[]): void {
		const last_user_idx = messages.findLastIndex((m) => m.role === AiMessageRole.USER);
		if (last_user_idx <= 0) return;

		const is_large_result = (m: AiMessage) =>
			m.role === AiMessageRole.TOOL && m.content.length > ConversationService.COMPRESS_THRESHOLD;

		for (let i = 0; i < last_user_idx; i++) {
			if (is_large_result(messages[i])) {
				messages[i] = {...messages[i], content: '[Result processed]'};
			}
		}
	}

	/**
	 * Enforce max message count by dropping the oldest messages after the system message.
	 * System message (index 0) is always preserved.
	 * Mutates the array in place.
	 */
	private truncateHistory(messages: AiMessage[]): void {
		if (messages.length <= ConversationService.MAX_MESSAGES) return;
		const excess = messages.length - ConversationService.MAX_MESSAGES;
		messages.splice(1, excess);
	}

	/* *******************************************************
		Conversation Lifecycle
	******************************************************** */

	/** Find the active conversation for a chat, auto-expiring stale ones */
	public async getActiveConversation(chat_id: string): Promise<Conversation | null> {
		const conversation = await this.conversationRepository.findOne({
			where: {chat_id, status: ConversationStatus.ACTIVE},
		});
		if (!conversation) return null;

		const now = DateTime.utc().toUnixInteger();
		if (now - conversation.last_activity_at > ConversationService.IDLE_TIMEOUT_SECONDS) {
			await this.expireConversation(conversation.id);
			return null;
		}

		return conversation;
	}

	/** Create a new conversation, expiring any existing active one for this chat */
	public async createConversation(agent: Agent, user_id: string, chat_id: string): Promise<Conversation> {
		await this.conversationRepository.update({chat_id, status: ConversationStatus.ACTIVE}, {status: ConversationStatus.EXPIRED});

		const system_message = await this.buildConversationSystemMessage(agent);
		const messages: AiMessage[] = [{role: AiMessageRole.SYSTEM, content: system_message}];

		const now = DateTime.utc().toUnixInteger();
		const conversation = this.conversationRepository.create({
			source_agent: agent,
			user_id,
			chat_id,
			status: ConversationStatus.ACTIVE,
			messages: JSON.stringify(messages),
			tokens_used: 0,
			created_at: now,
			last_activity_at: now,
		});

		return this.conversationRepository.save(conversation);
	}

	/** Build the system message with runtime context and recent agent run summaries */
	private async buildConversationSystemMessage(agent: Agent): Promise<string> {
		const base = this.agentService.buildSystemMessage(agent);

		const agents = await this.agentService.getAgents();
		const run_results = await Promise.all(
			agents.map((a) =>
				this.agentService.getAgentRuns({agent_id: a.id, page_size: 3, notified: true}).then((runs) => ({agent: a, runs})),
			),
		);

		const recent_summaries: string[] = [];
		for (const {agent: a, runs} of run_results) {
			for (const run of runs) {
				if (run.status === AgentRunStatus.SUCCESS && run.result) {
					const summary = run.result.length > 300 ? run.result.slice(0, 300) + '...' : run.result;
					recent_summaries.push(`[${this.agentService.resolveName(a)}] ${summary}`);
				}
			}
		}

		if (!recent_summaries.length) return base;
		return `${base}\n\n[Recent Agent Activity]\n${recent_summaries.join('\n')}`;
	}

	/** Expire a single conversation */
	public async expireConversation(id: string): Promise<void> {
		await this.conversationRepository.update(id, {status: ConversationStatus.EXPIRED});
	}

	/** Bulk-expire all stale active conversations */
	public async cleanupExpiredConversations(): Promise<void> {
		const cutoff = DateTime.utc().toUnixInteger() - ConversationService.IDLE_TIMEOUT_SECONDS;
		const result = await this.conversationRepository
			.createQueryBuilder()
			.update()
			.set({status: ConversationStatus.EXPIRED})
			.where('status = :status AND last_activity_at < :cutoff', {
				status: ConversationStatus.ACTIVE,
				cutoff,
			})
			.execute();

		if (result.affected) {
			this.logger.log(`Expired ${result.affected} stale conversations`);
		}
	}
}
