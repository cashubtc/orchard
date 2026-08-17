/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {FetchService} from '#server/modules/fetch/fetch.service';
import {SettingService} from '#server/modules/setting/setting.service';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {AiHealthService} from './aihealth.service.js';
import {OrchardAiHealth} from './aihealth.model.js';

describe('AiHealthService', () => {
	let aiHealthService: AiHealthService;
	let fetchService: jest.Mocked<FetchService>;
	let settingService: jest.Mocked<SettingService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AiHealthService,
				{provide: FetchService, useValue: {fetchWithProxy: jest.fn()}},
				{provide: SettingService, useValue: {getSetting: jest.fn(), getStringSetting: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		aiHealthService = module.get<AiHealthService>(AiHealthService);
		fetchService = module.get(FetchService);
		settingService = module.get(SettingService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(aiHealthService).toBeDefined();
	});

	it('returns success for ollama when fetch succeeds', async () => {
		settingService.getStringSetting.mockResolvedValueOnce('ollama');
		settingService.getStringSetting.mockResolvedValueOnce('http://localhost:11434');
		fetchService.fetchWithProxy.mockResolvedValue({ok: true} as any);

		const result = await aiHealthService.checkHealth('TAG');
		expect(result).toBeInstanceOf(OrchardAiHealth);
		expect(result.status).toBe(true);
		expect(result.vendor).toBe('ollama');
	});

	it('returns failure for ollama when fetch returns non-ok status', async () => {
		settingService.getStringSetting.mockResolvedValueOnce('ollama');
		settingService.getStringSetting.mockResolvedValueOnce('http://localhost:11434');
		fetchService.fetchWithProxy.mockResolvedValue({ok: false, status: 500} as any);

		const result = await aiHealthService.checkHealth('TAG');
		expect(result.status).toBe(false);
		expect(result.message).toContain('500');
	});

	it('returns success for openrouter when fetch succeeds', async () => {
		settingService.getStringSetting.mockResolvedValueOnce('openrouter');
		settingService.getStringSetting.mockResolvedValueOnce('sk-or-test-key');
		fetchService.fetchWithProxy.mockResolvedValue({ok: true} as any);

		const result = await aiHealthService.checkHealth('TAG');
		expect(result).toBeInstanceOf(OrchardAiHealth);
		expect(result.status).toBe(true);
		expect(result.vendor).toBe('openrouter');
	});

	it('returns failure for openrouter when API key is empty', async () => {
		settingService.getStringSetting.mockResolvedValueOnce('openrouter');
		settingService.getStringSetting.mockResolvedValueOnce(null);

		const result = await aiHealthService.checkHealth('TAG');
		expect(result.status).toBe(false);
		expect(result.message).toContain('not configured');
	});

	it('wraps errors via resolveError and throws OrchardApiError', async () => {
		settingService.getStringSetting.mockRejectedValue(new Error('DB error'));
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.AiError});

		await expect(aiHealthService.checkHealth('MY_TAG')).rejects.toBeInstanceOf(OrchardApiError);
		const calls = errorService.resolveError.mock.calls;
		const [, , tag_arg, code_arg] = calls[calls.length - 1];
		expect(tag_arg).toBe('MY_TAG');
		expect(code_arg).toEqual({errord: OrchardErrorCode.AiError});
	});
});
