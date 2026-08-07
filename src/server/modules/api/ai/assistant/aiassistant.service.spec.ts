/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {ErrorService} from '@server/modules/error/error.service';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
import {AiAssistant} from '@server/modules/ai/assistant/ai.assistant.enums';
/* Local Dependencies */
import {AiAssistantService} from './aiassistant.service.js';

describe('AiAssistantService', () => {
	let aiAssistantService: AiAssistantService;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [AiAssistantService, {provide: ErrorService, useValue: {resolveError: jest.fn()}}],
		}).compile();

		aiAssistantService = module.get<AiAssistantService>(AiAssistantService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(aiAssistantService).toBeDefined();
	});

	it('returns assistant when found', async () => {
		const assistant = await aiAssistantService.getAssistant('TAG', AiAssistant.DEFAULT);
		expect(assistant).toBeDefined();
	});

	it('wraps errors via resolveError and throws OrchardApiError when assistant missing', async () => {
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.AiError});
		await expect(aiAssistantService.getAssistant('MY_TAG', 'missing' as any)).rejects.toBeInstanceOf(OrchardApiError);
		const calls = errorService.resolveError.mock.calls;
		const [, , tag_arg, code_arg] = calls[calls.length - 1];
		expect(tag_arg).toBe('MY_TAG');
		expect(code_arg).toEqual({errord: OrchardErrorCode.AiError});
	});
});
