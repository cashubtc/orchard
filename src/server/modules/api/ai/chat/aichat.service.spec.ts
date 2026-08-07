/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {AiService} from '@server/modules/ai/ai.service';
import {ErrorService} from '@server/modules/error/error.service';
import {OrchardErrorCode} from '@server/modules/error/error.types';
/* Local Dependencies */
import {AiChatService} from './aichat.service.js';

describe('AiChatService', () => {
	let aiChatService: AiChatService;
	let aiService: jest.Mocked<AiService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AiChatService,
				{provide: AiService, useValue: {streamAssistant: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		aiChatService = module.get<AiChatService>(AiChatService);
		aiService = module.get(AiService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(aiChatService).toBeDefined();
	});

	it('streams chat and emits parsed chunks', async () => {
		const stream_chunks = [
			{model: 'm', created_at: '2024-01-01T00:00:00Z', message: {role: 'assistant', content: 'hi'}, done: false},
			{model: 'm', created_at: '2024-01-01T00:00:01Z', message: {role: 'assistant', content: 'bye'}, done: true},
		];

		async function* mockGenerator() {
			for (const chunk of stream_chunks) {
				yield chunk;
			}
		}

		(aiService.streamAssistant as jest.Mock).mockReturnValue(mockGenerator());

		const received: any[] = [];
		aiChatService.onChatUpdate((chunk) => received.push(chunk));

		const ok = await aiChatService.streamChat('TAG', {id: '1', model: 'm', agent: null, messages: []} as any);

		expect(ok).toBe(true);
		expect(received.length).toBe(2);
	});

	it('emits error chunk and calls resolveError on stream errors', async () => {
		async function* mockErrorGenerator() {
			throw new Error('boom');
		}

		(aiService.streamAssistant as jest.Mock).mockReturnValue(mockErrorGenerator());
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.AiError});

		const received: any[] = [];
		aiChatService.onChatUpdate((chunk) => received.push(chunk));

		await aiChatService.streamChat('MY_TAG', {id: '1', model: 'm', agent: null, messages: []} as any);

		expect(received.length).toBe(1);
		expect(received[0].message.content).toBe('boom');
		expect(received[0].done).toBe(true);
		const calls = errorService.resolveError.mock.calls;
		const [, , tag_arg, code_arg] = calls[calls.length - 1];
		expect(tag_arg).toBe('MY_TAG');
		expect(code_arg).toEqual({errord: OrchardErrorCode.AiError});
	});
});
