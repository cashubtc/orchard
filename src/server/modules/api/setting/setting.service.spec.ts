/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {SettingService} from '@server/modules/setting/setting.service';
import {ErrorService} from '@server/modules/error/error.service';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
import {SettingKey, SettingValue} from '@server/modules/setting/setting.enums';
import {MessageService} from '@server/modules/message/message.service';
/* Local Dependencies */
import {ApiSettingService} from './setting.service.js';

/**
 * Test suite for ApiSettingService
 * Tests the API wrapper layer for settings
 */
describe('ApiSettingService', () => {
	let apiSettingService: ApiSettingService;
	let settingService: jest.Mocked<SettingService>;
	let errorService: jest.Mocked<ErrorService>;
	let messageService: jest.Mocked<MessageService>;

	// mock data for testing
	const mock_setting = {
		key: SettingKey.BITCOIN_ORACLE,
		value: 'true',
		value_type: SettingValue.BOOLEAN,
		description: 'Whether the bitcoin oracle is enabled',
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ApiSettingService,
				{
					provide: SettingService,
					useValue: {
						getSettings: jest.fn(),
						updateSettings: jest.fn(),
					},
				},
				{
					provide: ErrorService,
					useValue: {
						resolveError: jest.fn(),
					},
				},
				{
					provide: MessageService,
					useValue: {
						reinitialize: jest.fn(),
					},
				},
			],
		}).compile();

		apiSettingService = module.get<ApiSettingService>(ApiSettingService);
		settingService = module.get(SettingService);
		errorService = module.get(ErrorService);
		messageService = module.get(MessageService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	/**
	 * Test service instantiation
	 */
	it('should be defined', () => {
		expect(apiSettingService).toBeDefined();
	});

	/**
	 * Test getSettings method
	 */
	describe('getSettings', () => {
		it('should return settings wrapped in OrchardSetting models', async () => {
			// arrange
			const mock_settings = [mock_setting];
			settingService.getSettings.mockResolvedValue(mock_settings as any);

			// act
			const result = await apiSettingService.getSettings('TEST_TAG');

			// assert
			expect(result).toHaveLength(1);
			expect(result[0]).toHaveProperty('key', SettingKey.BITCOIN_ORACLE);
			expect(settingService.getSettings).toHaveBeenCalledTimes(1);
		});

		it('should handle empty settings list', async () => {
			// arrange
			settingService.getSettings.mockResolvedValue([]);

			// act
			const result = await apiSettingService.getSettings('TEST_TAG');

			// assert
			expect(result).toEqual([]);
			expect(settingService.getSettings).toHaveBeenCalledTimes(1);
		});

		it('should wrap errors and throw OrchardApiError', async () => {
			// arrange
			const error = new Error('Database error');
			settingService.getSettings.mockRejectedValue(error);
			errorService.resolveError.mockReturnValue({code: OrchardErrorCode.SettingError});

			// act & assert
			await expect(apiSettingService.getSettings('ERROR_TAG')).rejects.toBeInstanceOf(OrchardApiError);
			expect(errorService.resolveError).toHaveBeenCalledWith(expect.anything(), error, 'ERROR_TAG', {
				errord: OrchardErrorCode.SettingError,
			});
		});
	});

	/**
	 * Test updateSettings method
	 */
	describe('updateSettings', () => {
		it('should update settings and return OrchardSetting models', async () => {
			// arrange
			const updated_setting = {...mock_setting, value: 'false'};
			settingService.updateSettings.mockResolvedValue([updated_setting] as any);

			// act
			const result = await apiSettingService.updateSettings('UPDATE_TAG', [SettingKey.BITCOIN_ORACLE], ['false']);

			// assert
			expect(result).toHaveLength(1);
			expect(result[0]).toHaveProperty('key', SettingKey.BITCOIN_ORACLE);
			expect(result[0]).toHaveProperty('value', 'false');
			expect(settingService.updateSettings).toHaveBeenCalledWith([SettingKey.BITCOIN_ORACLE], ['false']);
		});

		it('should wrap errors and throw OrchardApiError', async () => {
			// arrange
			const error = new Error('Update failed');
			settingService.updateSettings.mockRejectedValue(error);
			errorService.resolveError.mockReturnValue({code: OrchardErrorCode.SettingError});

			// act & assert
			await expect(apiSettingService.updateSettings('ERROR_TAG', [SettingKey.BITCOIN_ORACLE], ['invalid'])).rejects.toBeInstanceOf(
				OrchardApiError,
			);
			expect(errorService.resolveError).toHaveBeenCalledWith(expect.anything(), error, 'ERROR_TAG', {
				errord: OrchardErrorCode.SettingError,
			});
		});

		it('should reinitialize message service when message keys are updated', async () => {
			// arrange
			settingService.updateSettings.mockResolvedValue([mock_setting] as any);

			// act
			await apiSettingService.updateSettings('TAG', [SettingKey.MESSAGES_ENABLED], ['true']);

			// assert
			expect(messageService.reinitialize).toHaveBeenCalledTimes(1);
		});

		it('should not reinitialize message service for non-message keys', async () => {
			// arrange
			settingService.updateSettings.mockResolvedValue([mock_setting] as any);

			// act
			await apiSettingService.updateSettings('TAG', [SettingKey.BITCOIN_ORACLE], ['true']);

			// assert
			expect(messageService.reinitialize).not.toHaveBeenCalled();
		});

		it('should pass correct parameters to underlying service', async () => {
			// arrange
			settingService.updateSettings.mockResolvedValue([mock_setting] as any);

			// act
			await apiSettingService.updateSettings('TAG', [SettingKey.BITCOIN_ORACLE], ['new_value']);

			// assert
			expect(settingService.updateSettings).toHaveBeenCalledTimes(1);
			expect(settingService.updateSettings).toHaveBeenCalledWith([SettingKey.BITCOIN_ORACLE], ['new_value']);
		});
	});

	/* *******************************************************
		Masking
	******************************************************** */

	describe('masking', () => {
		it('should mask sensitive setting values in getSettings', async () => {
			// arrange
			const sensitive_setting = {
				key: SettingKey.AI_OPENROUTER_KEY,
				value: 'sk-or-v1-abc123',
				value_type: SettingValue.STRING,
				description: 'The OpenRouter API key',
			};
			settingService.getSettings.mockResolvedValue([sensitive_setting] as any);

			// act
			const result = await apiSettingService.getSettings('TEST_TAG');

			// assert
			expect(result[0].value).toBe('\u2022\u2022\u2022\u2022c123');
			expect(result[0].is_sensitive).toBe(true);
		});

		it('should not mask non-sensitive setting values', async () => {
			// arrange
			settingService.getSettings.mockResolvedValue([mock_setting] as any);

			// act
			const result = await apiSettingService.getSettings('TEST_TAG');

			// assert
			expect(result[0].value).toBe('true');
			expect(result[0].is_sensitive).toBe(false);
		});

		it('should mask sensitive setting values in updateSettings response', async () => {
			// arrange
			const sensitive_setting = {
				key: SettingKey.MESSAGES_TELEGRAM_BOT_TOKEN,
				value: '123456:ABC-DEF',
				value_type: SettingValue.STRING,
				description: 'The Telegram bot token',
			};
			settingService.updateSettings.mockResolvedValue([sensitive_setting] as any);

			// act
			const result = await apiSettingService.updateSettings('TAG', [SettingKey.MESSAGES_TELEGRAM_BOT_TOKEN], ['123456:ABC-DEF']);

			// assert
			expect(result[0].value).toBe('\u2022\u2022\u2022\u2022-DEF');
			expect(result[0].is_sensitive).toBe(true);
		});

		it('should return empty string for empty sensitive setting', async () => {
			// arrange
			const sensitive_setting = {
				key: SettingKey.AI_OPENROUTER_KEY,
				value: '',
				value_type: SettingValue.STRING,
				description: 'The OpenRouter API key',
			};
			settingService.getSettings.mockResolvedValue([sensitive_setting] as any);

			// act
			const result = await apiSettingService.getSettings('TEST_TAG');

			// assert
			expect(result[0].value).toBe('');
		});
	});
});
