/* Vendor Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {getRepositoryToken} from '@nestjs/typeorm';
/* Application Dependencies */
import {AgentService} from '#server/modules/ai/agent/agent.service';
import {MessageService} from '#server/modules/message/message.service';
import {AgentKey} from '#server/modules/ai/agent/agent.enums';
/* Local Dependencies */
import {ConversationService} from './conversation.service.js';
import {Conversation} from './conversation.entity.js';
import {ConversationStatus} from './conversation.enums.js';

describe('ConversationService', () => {
	let service: ConversationService;

	const mock_conversation_repo = {
		find: jest.fn().mockResolvedValue([]),
		findOne: jest.fn().mockResolvedValue(null),
		create: jest.fn().mockImplementation((dto) => dto),
		save: jest.fn().mockImplementation((entity) => Promise.resolve({id: 'conv-uuid', ...entity})),
		update: jest.fn().mockResolvedValue({affected: 1}),
		createQueryBuilder: jest.fn().mockReturnValue({
			update: jest.fn().mockReturnThis(),
			set: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			execute: jest.fn().mockResolvedValue({affected: 0}),
		}),
	};

	const mock_agent = {
		id: 'agent-uuid',
		agent_key: AgentKey.GROUNDSKEEPER,
		name: 'Groundskeeper',
		active: true,
		model: 'test-model',
		system_message: null,
		tools: null,
		schedules: '[]',
	};

	const mock_agent_service = {
		getAgentByKey: jest.fn().mockResolvedValue(mock_agent),
		getAgent: jest.fn().mockResolvedValue(mock_agent),
		getAgents: jest.fn().mockResolvedValue([mock_agent]),
		getAgentRuns: jest.fn().mockResolvedValue([]),
		runToolLoop: jest.fn().mockResolvedValue({
			result: 'Hello, operator!',
			tokens_used: 100,
			messages: [
				{role: 'system', content: 'sys'},
				{role: 'user', content: 'hi'},
				{role: 'assistant', content: 'Hello, operator!'},
			],
		}),
		buildRuntimeContext: jest.fn().mockReturnValue('[Runtime Context]\nAgent ID: agent-uuid'),
		buildSystemMessage: jest.fn().mockReturnValue('System message'),
		resolveToolNames: jest.fn().mockReturnValue([]),
		resolveName: jest.fn().mockReturnValue('Groundskeeper'),
	};

	const mock_message_service = {
		sendReply: jest.fn().mockResolvedValue({success: true, message_id: 42}),
		editReply: jest.fn().mockResolvedValue(true),
	};

	beforeEach(async () => {
		jest.clearAllMocks();
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ConversationService,
				{provide: getRepositoryToken(Conversation), useValue: mock_conversation_repo},
				{provide: AgentService, useValue: mock_agent_service},
				{provide: MessageService, useValue: mock_message_service},
			],
		}).compile();
		service = module.get<ConversationService>(ConversationService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('handleIncomingMessage', () => {
		it('should create a conversation when none exists', async () => {
			mock_conversation_repo.findOne.mockResolvedValueOnce(null);

			await service.handleIncomingMessage({chat_id: 'chat-123', user_id: 'user-456', text: 'hello'});

			expect(mock_agent_service.getAgentByKey).toHaveBeenCalledWith(AgentKey.GROUNDSKEEPER);
			expect(mock_conversation_repo.save).toHaveBeenCalled();
			expect(mock_agent_service.runToolLoop).toHaveBeenCalled();
			/* Thinking indicator sent first, then final reply edits it */
			expect(mock_message_service.sendReply).toHaveBeenCalledWith('chat-123', '...');
			expect(mock_message_service.editReply).toHaveBeenCalledWith('chat-123', 42, 'Hello, operator!');
		});

		it('should reuse an active conversation', async () => {
			const now = Math.floor(Date.now() / 1000);
			mock_conversation_repo.findOne.mockResolvedValueOnce({
				id: 'existing-conv',
				chat_id: 'chat-123',
				status: ConversationStatus.ACTIVE,
				messages: JSON.stringify([{role: 'system', content: 'sys'}]),
				tokens_used: 50,
				last_activity_at: now,
			});

			await service.handleIncomingMessage({chat_id: 'chat-123', user_id: 'user-456', text: 'follow-up'});

			expect(mock_conversation_repo.save).not.toHaveBeenCalled();
			expect(mock_agent_service.runToolLoop).toHaveBeenCalled();
			/* First update persists the user message, second updates with agent response */
			const final_update = mock_conversation_repo.update.mock.calls[1];
			expect(final_update[0]).toBe('existing-conv');
			expect(final_update[1].tokens_used).toBe(150);
		});
	});

	describe('handleReset', () => {
		it('should expire active conversation and reply', async () => {
			const now = Math.floor(Date.now() / 1000);
			mock_conversation_repo.findOne.mockResolvedValueOnce({
				id: 'active-conv',
				chat_id: 'chat-123',
				status: ConversationStatus.ACTIVE,
				last_activity_at: now,
			});

			await service.handleReset({chat_id: 'chat-123', user_id: 'user-456'});

			expect(mock_conversation_repo.update).toHaveBeenCalledWith('active-conv', {status: ConversationStatus.EXPIRED});
			expect(mock_message_service.sendReply).toHaveBeenCalledWith('chat-123', 'Conversation reset. Send a message to start fresh.');
		});

		it('should reply even when no active conversation exists', async () => {
			mock_conversation_repo.findOne.mockResolvedValueOnce(null);

			await service.handleReset({chat_id: 'chat-123', user_id: 'user-456'});

			expect(mock_message_service.sendReply).toHaveBeenCalledWith('chat-123', 'Conversation reset. Send a message to start fresh.');
		});
	});

	describe('getActiveConversation', () => {
		it('should return null for expired conversations', async () => {
			const stale_time = Math.floor(Date.now() / 1000) - 7200;
			mock_conversation_repo.findOne.mockResolvedValueOnce({
				id: 'stale-conv',
				chat_id: 'chat-123',
				status: ConversationStatus.ACTIVE,
				last_activity_at: stale_time,
			});

			const result = await service.getActiveConversation('chat-123');

			expect(result).toBeNull();
			expect(mock_conversation_repo.update).toHaveBeenCalledWith('stale-conv', {status: ConversationStatus.EXPIRED});
		});
	});

	describe('createConversation', () => {
		it('should expire existing active conversations for the same chat', async () => {
			await service.createConversation(mock_agent as any, 'user-456', 'chat-123');

			expect(mock_conversation_repo.update).toHaveBeenCalledWith(
				{chat_id: 'chat-123', status: ConversationStatus.ACTIVE},
				{status: ConversationStatus.EXPIRED},
			);
			expect(mock_conversation_repo.save).toHaveBeenCalled();
		});
	});

	describe('handleIncomingMessage — error paths', () => {
		it('should send error message when runToolLoop throws', async () => {
			mock_conversation_repo.findOne.mockResolvedValueOnce(null);
			mock_agent_service.runToolLoop.mockRejectedValueOnce(new Error('LLM unavailable'));

			await service.handleIncomingMessage({chat_id: 'chat-123', user_id: 'user-456', text: 'hello'});

			expect(mock_message_service.editReply).toHaveBeenCalledWith('chat-123', 42, 'Something went wrong processing your message.');
		});

		it('should do nothing when ORCHARD agent is not found', async () => {
			mock_agent_service.getAgentByKey.mockResolvedValueOnce(null);

			await service.handleIncomingMessage({chat_id: 'chat-123', user_id: 'user-456', text: 'hello'});

			expect(mock_agent_service.runToolLoop).not.toHaveBeenCalled();
			expect(mock_message_service.sendReply).not.toHaveBeenCalled();
		});

		it('should fall back to sendReply when thinking has no message_id', async () => {
			mock_conversation_repo.findOne.mockResolvedValueOnce(null);
			mock_message_service.sendReply.mockResolvedValueOnce({success: true});

			await service.handleIncomingMessage({chat_id: 'chat-123', user_id: 'user-456', text: 'hello'});

			/* When sendReply returns no message_id, replyOrEdit should call sendReply for the final message */
			expect(mock_message_service.sendReply).toHaveBeenCalledWith('chat-123', '...');
		});
	});

	describe('compressPreviousTurns (via handleIncomingMessage)', () => {
		it('should compress large tool results from previous turns', async () => {
			const now = Math.floor(Date.now() / 1000);
			const large_content = 'x'.repeat(600);
			/* Two user messages — tool result from first turn is before the second user message */
			const messages = [
				{role: 'system', content: 'sys'},
				{role: 'user', content: 'first question'},
				{role: 'assistant', content: '', tool_calls: [{id: 'tc-1', function: {name: 'GET_MINT_INFO', arguments: {}}}]},
				{role: 'tool', content: large_content, tool_call_id: 'tc-1'},
				{role: 'assistant', content: 'Here is the info'},
				{role: 'user', content: 'second question'},
				{role: 'assistant', content: 'More info'},
			];

			mock_conversation_repo.findOne.mockResolvedValueOnce({
				id: 'conv-1',
				chat_id: 'chat-123',
				status: ConversationStatus.ACTIVE,
				messages: JSON.stringify(messages),
				tokens_used: 50,
				last_activity_at: now,
			});

			await service.handleIncomingMessage({chat_id: 'chat-123', user_id: 'user-456', text: 'follow-up'});

			/* The first update call persists the user message with compressed previous turns */
			const persist_call = mock_conversation_repo.update.mock.calls[0];
			const persisted_messages = JSON.parse(persist_call[1].messages);
			const tool_msg = persisted_messages.find((m: any) => m.role === 'tool');
			expect(tool_msg.content).toBe('[Result processed]');
		});

		it('should not compress tool results after the last user message', async () => {
			const now = Math.floor(Date.now() / 1000);
			/* Only one user message — tool result is AFTER it, so not compressed */
			const messages = [
				{role: 'system', content: 'sys'},
				{role: 'user', content: 'question'},
				{role: 'assistant', content: '', tool_calls: [{id: 'tc-1', function: {name: 'GET_MINT_INFO', arguments: {}}}]},
				{role: 'tool', content: 'x'.repeat(600), tool_call_id: 'tc-1'},
				{role: 'assistant', content: 'answer'},
			];

			mock_conversation_repo.findOne.mockResolvedValueOnce({
				id: 'conv-1',
				chat_id: 'chat-123',
				status: ConversationStatus.ACTIVE,
				messages: JSON.stringify(messages),
				tokens_used: 50,
				last_activity_at: now,
			});

			await service.handleIncomingMessage({chat_id: 'chat-123', user_id: 'user-456', text: 'another'});

			const persist_call = mock_conversation_repo.update.mock.calls[0];
			const persisted_messages = JSON.parse(persist_call[1].messages);
			/* Tool at index 3 is after the last user (index 1), so it remains uncompressed */
			const tool_msg = persisted_messages.find((m: any) => m.role === 'tool');
			expect(tool_msg.content).toBe('x'.repeat(600));
		});
	});

	describe('truncateHistory (via handleIncomingMessage)', () => {
		it('should preserve system message and drop oldest messages when exceeding MAX_MESSAGES', async () => {
			mock_conversation_repo.findOne.mockResolvedValueOnce(null);

			/* Simulate runToolLoop returning more than 50 messages */
			const many_messages = [{role: 'system', content: 'sys'}];
			for (let i = 0; i < 55; i++) {
				many_messages.push({role: 'user', content: `msg-${i}`});
			}

			mock_agent_service.runToolLoop.mockResolvedValueOnce({
				result: 'Done',
				tokens_used: 200,
				messages: many_messages,
			});

			await service.handleIncomingMessage({chat_id: 'chat-123', user_id: 'user-456', text: 'hello'});

			/* createConversation calls update[0] to expire existing, update[1] persists user message, update[2] persists final */
			const final_update = mock_conversation_repo.update.mock.calls[2];
			const final_messages = JSON.parse(final_update[1].messages);
			expect(final_messages.length).toBe(50);
			expect(final_messages[0].role).toBe('system');
			expect(final_messages[0].content).toBe('sys');
		});
	});

	describe('cleanupExpiredConversations', () => {
		it('should bulk-expire stale conversations', async () => {
			await service.cleanupExpiredConversations();

			const qb = mock_conversation_repo.createQueryBuilder();
			expect(qb.update).toHaveBeenCalled();
			expect(qb.set).toHaveBeenCalledWith({status: ConversationStatus.EXPIRED});
		});
	});
});
