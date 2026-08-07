/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {AiService} from '#server/modules/ai/ai.service';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {AiModelService} from './aimodel.service.js';
import {OrchardAiModel} from './aimodel.model.js';

describe('AiModelService', () => {
	let aiModelService: AiModelService;
	let aiService: jest.Mocked<AiService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AiModelService,
				{provide: AiService, useValue: {getModels: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		aiModelService = module.get<AiModelService>(AiModelService);
		aiService = module.get(AiService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(aiModelService).toBeDefined();
	});

	it('returns OrchardAiModel[] on success', async () => {
		aiService.getModels.mockResolvedValue([{name: 'm'}] as any);
		const result = await aiModelService.getModels('TAG');
		expect(result[0]).toBeInstanceOf(OrchardAiModel);
	});

	it('wraps errors via resolveError and throws OrchardApiError', async () => {
		aiService.getModels.mockRejectedValue(new Error('boom'));
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.AiError});
		await expect(aiModelService.getModels('MY_TAG')).rejects.toBeInstanceOf(OrchardApiError);
		const calls = errorService.resolveError.mock.calls;
		const [, , tag_arg, code_arg] = calls[calls.length - 1];
		expect(tag_arg).toBe('MY_TAG');
		expect(code_arg).toEqual({errord: OrchardErrorCode.AiError});
	});
});
