/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {getRepositoryToken} from '@nestjs/typeorm';
import {ConfigService} from '@nestjs/config';
/* Vendor Dependencies */
import {Repository} from 'typeorm';
/* Local Dependencies */
import {SettingService} from './setting.service.js';
import {Setting} from './setting.entity.js';
import {SettingKey, SettingValue} from './setting.enums.js';
import {DEFAULT_SETTINGS} from './setting.config.js';
import {isEncrypted, deriveEncryptionKey, encryptValue} from './setting.helpers.js';

/**
 * Test suite for SettingService
 * Tests all public methods and initialization logic
 */
describe('SettingService', () => {
	let service: SettingService;
	let _repository: Repository<Setting>;

	// mock data for testing
	const mock_setting: Setting = {
		key: SettingKey.BITCOIN_ORACLE,
		value: 'true',
		value_type: SettingValue.BOOLEAN,
		description: 'Whether the bitcoin oracle is enabled',
	};

	const mock_repository: any = {
		findOne: jest.fn(),
		find: jest.fn(),
		create: jest.fn(),
		save: jest.fn(),
		manager: {
			transaction: jest.fn((cb: any) => cb({getRepository: () => mock_repository})),
		},
	};

	const test_crypto_key = 'ab'.repeat(32);
	const test_setup_key = 'test-secret-key';

	const mock_config_service = {
		get: jest.fn().mockImplementation((key: string) => {
			if (key === 'server.crypto_key') return test_crypto_key;
			if (key === 'server.setup_key') return test_setup_key;
			return undefined;
		}),
	};

	beforeEach(async () => {
		// reset all mocks before each test
		jest.clearAllMocks();

		// restore default config mock
		mock_config_service.get.mockImplementation((key: string) => {
			if (key === 'server.crypto_key') return test_crypto_key;
			if (key === 'server.setup_key') return test_setup_key;
			return undefined;
		});

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SettingService,
				{
					provide: getRepositoryToken(Setting),
					useValue: mock_repository,
				},
				{
					provide: ConfigService,
					useValue: mock_config_service,
				},
			],
		}).compile();

		service = module.get<SettingService>(SettingService);
		_repository = module.get<Repository<Setting>>(getRepositoryToken(Setting));
	});

	/**
	 * Test service instantiation
	 */
	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	/**
	 * Test onModuleInit lifecycle hook
	 */
	describe('onModuleInit', () => {
		it('should initialize default settings when module initializes', async () => {
			// arrange
			mock_repository.find.mockResolvedValue([]);
			mock_repository.findOne.mockResolvedValue(null);
			mock_repository.create.mockReturnValue(mock_setting);
			mock_repository.save.mockResolvedValue(mock_setting);

			// act
			await service.onModuleInit();

			// assert
			expect(mock_repository.findOne).toHaveBeenCalledTimes(DEFAULT_SETTINGS.length);
			expect(mock_repository.create).toHaveBeenCalledTimes(DEFAULT_SETTINGS.length);
			expect(mock_repository.save).toHaveBeenCalledTimes(DEFAULT_SETTINGS.length);
		});

		it('should not duplicate existing settings', async () => {
			// arrange
			mock_repository.find.mockResolvedValue([]);
			mock_repository.findOne.mockResolvedValue(mock_setting);

			// act
			await service.onModuleInit();

			// assert
			expect(mock_repository.findOne).toHaveBeenCalledTimes(DEFAULT_SETTINGS.length);
			expect(mock_repository.create).not.toHaveBeenCalled();
			expect(mock_repository.save).not.toHaveBeenCalled();
		});

		it('should initialize only missing default settings', async () => {
			// arrange - first setting exists, others don't
			mock_repository.find.mockResolvedValue([]);
			mock_repository.findOne
				.mockResolvedValueOnce(mock_setting) // first call returns existing
				.mockResolvedValue(null); // subsequent calls return null
			mock_repository.create.mockReturnValue(mock_setting);
			mock_repository.save.mockResolvedValue(mock_setting);

			// act
			await service.onModuleInit();

			// assert
			expect(mock_repository.findOne).toHaveBeenCalledTimes(DEFAULT_SETTINGS.length);
			expect(mock_repository.create).toHaveBeenCalledTimes(DEFAULT_SETTINGS.length - 1);
			expect(mock_repository.save).toHaveBeenCalledTimes(DEFAULT_SETTINGS.length - 1);
		});
	});

	/**
	 * Test getSettings method
	 */
	describe('getSettings', () => {
		it('should return all settings', async () => {
			// arrange
			const mock_settings = [mock_setting];
			mock_repository.find.mockResolvedValue(mock_settings);

			// act
			const result = await service.getSettings();

			// assert
			expect(result).toEqual(mock_settings);
			expect(mock_repository.find).toHaveBeenCalledTimes(1);
		});

		it('should return empty array when no settings exist', async () => {
			// arrange
			mock_repository.find.mockResolvedValue([]);

			// act
			const result = await service.getSettings();

			// assert
			expect(result).toEqual([]);
			expect(mock_repository.find).toHaveBeenCalledTimes(1);
		});
	});

	/**
	 * Test getSetting method
	 */
	describe('getSetting', () => {
		it('should return a setting by key', async () => {
			// arrange
			mock_repository.findOne.mockResolvedValue(mock_setting);

			// act
			const result = await service.getSetting(SettingKey.BITCOIN_ORACLE);

			// assert
			expect(result).toEqual(mock_setting);
			expect(mock_repository.findOne).toHaveBeenCalledWith({
				where: {key: SettingKey.BITCOIN_ORACLE},
			});
		});

		it('should return null when setting does not exist', async () => {
			// arrange
			mock_repository.findOne.mockResolvedValue(null);

			// act
			const result = await service.getSetting(SettingKey.BITCOIN_ORACLE);

			// assert
			expect(result).toBeNull();
			expect(mock_repository.findOne).toHaveBeenCalledWith({
				where: {key: SettingKey.BITCOIN_ORACLE},
			});
		});
	});

	/**
	 * Test updateSettings method
	 */
	describe('updateSettings', () => {
		it('should update a single setting value', async () => {
			// arrange
			const updated_value = 'false';
			const updated_setting = {...mock_setting, value: updated_value};
			mock_repository.findOne.mockResolvedValue(mock_setting);
			mock_repository.save.mockResolvedValue(updated_setting);

			// act
			const result = await service.updateSettings([SettingKey.BITCOIN_ORACLE], [updated_value]);

			// assert
			expect(result).toHaveLength(1);
			expect(result[0].value).toBe(updated_value);
			expect(mock_repository.findOne).toHaveBeenCalledWith({
				where: {key: SettingKey.BITCOIN_ORACLE},
			});
			expect(mock_repository.save).toHaveBeenCalledWith({
				...mock_setting,
				value: updated_value,
			});
		});

		it('should update multiple settings', async () => {
			// arrange
			const mock_ai_setting: Setting = {
				key: SettingKey.AI_ENABLED,
				value: 'false',
				value_type: SettingValue.BOOLEAN,
				description: 'Whether AI is enabled',
			};
			mock_repository.findOne.mockResolvedValueOnce(mock_setting).mockResolvedValueOnce(mock_ai_setting);
			mock_repository.save
				.mockResolvedValueOnce({...mock_setting, value: 'false'})
				.mockResolvedValueOnce({...mock_ai_setting, value: 'true'});

			// act
			const result = await service.updateSettings([SettingKey.BITCOIN_ORACLE, SettingKey.AI_ENABLED], ['false', 'true']);

			// assert
			expect(result).toHaveLength(2);
			expect(result[0].value).toBe('false');
			expect(result[1].value).toBe('true');
			expect(mock_repository.save).toHaveBeenCalledTimes(2);
		});

		it('should throw error when setting does not exist', async () => {
			// arrange
			mock_repository.findOne.mockResolvedValue(null);

			// act & assert
			await expect(service.updateSettings([SettingKey.BITCOIN_ORACLE], ['false'])).rejects.toThrow(
				`Setting with key ${SettingKey.BITCOIN_ORACLE} not found`,
			);
			expect(mock_repository.findOne).toHaveBeenCalledWith({
				where: {key: SettingKey.BITCOIN_ORACLE},
			});
			expect(mock_repository.save).not.toHaveBeenCalled();
		});

		it('should handle updating to empty string', async () => {
			// arrange
			const updated_value = '';
			const updated_setting = {...mock_setting, value: updated_value};
			mock_repository.findOne.mockResolvedValue(mock_setting);
			mock_repository.save.mockResolvedValue(updated_setting);

			// act
			const result = await service.updateSettings([SettingKey.BITCOIN_ORACLE], [updated_value]);

			// assert
			expect(result[0].value).toBe(updated_value);
			expect(mock_repository.save).toHaveBeenCalled();
		});

		it('should persist the updated setting in the database', async () => {
			// arrange
			const new_value = 'updated_value';
			mock_repository.findOne.mockResolvedValue(mock_setting);
			mock_repository.save.mockResolvedValue({...mock_setting, value: new_value});

			// act
			await service.updateSettings([SettingKey.BITCOIN_ORACLE], [new_value]);

			// assert
			expect(mock_repository.save).toHaveBeenCalledTimes(1);
			expect(mock_repository.save).toHaveBeenCalledWith(
				expect.objectContaining({
					key: SettingKey.BITCOIN_ORACLE,
					value: new_value,
				}),
			);
		});
	});

	/* *******************************************************
		Typed Accessors
	******************************************************** */

	describe('getBooleanSetting', () => {
		it('should return true for boolean setting with value true', async () => {
			mock_repository.findOne.mockResolvedValue({...mock_setting, value: 'true', value_type: SettingValue.BOOLEAN});
			expect(await service.getBooleanSetting(SettingKey.BITCOIN_ORACLE)).toBe(true);
		});

		it('should return false for boolean setting with value false', async () => {
			mock_repository.findOne.mockResolvedValue({...mock_setting, value: 'false', value_type: SettingValue.BOOLEAN});
			expect(await service.getBooleanSetting(SettingKey.BITCOIN_ORACLE)).toBe(false);
		});

		it('should return false when setting does not exist', async () => {
			mock_repository.findOne.mockResolvedValue(null);
			expect(await service.getBooleanSetting(SettingKey.BITCOIN_ORACLE)).toBe(false);
		});

		it('should return false when value is empty', async () => {
			mock_repository.findOne.mockResolvedValue({...mock_setting, value: '', value_type: SettingValue.BOOLEAN});
			expect(await service.getBooleanSetting(SettingKey.BITCOIN_ORACLE)).toBe(false);
		});
	});

	describe('getStringSetting', () => {
		it('should return the string value', async () => {
			mock_repository.findOne.mockResolvedValue({
				key: SettingKey.AI_VENDOR,
				value: 'ollama',
				value_type: SettingValue.STRING,
				description: null,
			});
			expect(await service.getStringSetting(SettingKey.AI_VENDOR)).toBe('ollama');
		});

		it('should return null when setting does not exist', async () => {
			mock_repository.findOne.mockResolvedValue(null);
			expect(await service.getStringSetting(SettingKey.AI_VENDOR)).toBeNull();
		});

		it('should return null for empty string value', async () => {
			mock_repository.findOne.mockResolvedValue({
				key: SettingKey.AI_VENDOR,
				value: '',
				value_type: SettingValue.STRING,
				description: null,
			});
			expect(await service.getStringSetting(SettingKey.AI_VENDOR)).toBeNull();
		});
	});

	describe('getNumberSetting', () => {
		it('should return the parsed number', async () => {
			mock_repository.findOne.mockResolvedValue({
				key: SettingKey.BITCOIN_ORACLE,
				value: '42',
				value_type: SettingValue.NUMBER,
				description: null,
			});
			expect(await service.getNumberSetting(SettingKey.BITCOIN_ORACLE)).toBe(42);
		});

		it('should return null when setting does not exist', async () => {
			mock_repository.findOne.mockResolvedValue(null);
			expect(await service.getNumberSetting(SettingKey.BITCOIN_ORACLE)).toBeNull();
		});

		it('should return null for empty value', async () => {
			mock_repository.findOne.mockResolvedValue({
				key: SettingKey.BITCOIN_ORACLE,
				value: '',
				value_type: SettingValue.NUMBER,
				description: null,
			});
			expect(await service.getNumberSetting(SettingKey.BITCOIN_ORACLE)).toBeNull();
		});

		it('should return null for NaN values', async () => {
			mock_repository.findOne.mockResolvedValue({
				key: SettingKey.BITCOIN_ORACLE,
				value: 'abc',
				value_type: SettingValue.NUMBER,
				description: null,
			});
			expect(await service.getNumberSetting(SettingKey.BITCOIN_ORACLE)).toBeNull();
		});
	});

	/* *******************************************************
		Encryption
	******************************************************** */

	describe('encryption', () => {
		it('should encrypt sensitive settings on write', async () => {
			// arrange
			const sensitive_setting = {
				key: SettingKey.AI_OPENROUTER_KEY,
				value: 'old-key',
				value_type: SettingValue.STRING,
				description: 'The OpenRouter API key',
			};
			mock_repository.findOne.mockResolvedValue(sensitive_setting);
			mock_repository.save.mockImplementation((s: any) => Promise.resolve({...s}));
			await service.onModuleInit();

			// act
			await service.updateSettings([SettingKey.AI_OPENROUTER_KEY], ['sk-or-v1-newkey123']);

			// assert
			const saved = mock_repository.save.mock.calls[mock_repository.save.mock.calls.length - 1][0];
			expect(isEncrypted(saved.value)).toBe(true);
			expect(saved.value).not.toContain('sk-or-v1-newkey123');
		});

		it('should not encrypt non-sensitive settings on write', async () => {
			// arrange
			mock_repository.findOne.mockResolvedValue(mock_setting);
			mock_repository.save.mockImplementation((s: any) => Promise.resolve({...s}));
			await service.onModuleInit();

			// act
			await service.updateSettings([SettingKey.BITCOIN_ORACLE], ['false']);

			// assert
			const saved = mock_repository.save.mock.calls[mock_repository.save.mock.calls.length - 1][0];
			expect(saved.value).toBe('false');
		});

		it('should not encrypt empty values', async () => {
			// arrange
			const sensitive_setting = {
				key: SettingKey.AI_OPENROUTER_KEY,
				value: 'old-key',
				value_type: SettingValue.STRING,
				description: 'The OpenRouter API key',
			};
			mock_repository.findOne.mockResolvedValue(sensitive_setting);
			mock_repository.save.mockImplementation((s: any) => Promise.resolve({...s}));
			await service.onModuleInit();

			// act
			await service.updateSettings([SettingKey.AI_OPENROUTER_KEY], ['']);

			// assert
			const saved = mock_repository.save.mock.calls[mock_repository.save.mock.calls.length - 1][0];
			expect(saved.value).toBe('');
		});

		it('should decrypt sensitive settings on read', async () => {
			// arrange
			await service.onModuleInit();
			const sensitive_setting = {
				key: SettingKey.AI_OPENROUTER_KEY,
				value: 'old-key',
				value_type: SettingValue.STRING,
				description: 'The OpenRouter API key',
			};
			mock_repository.findOne.mockResolvedValue(sensitive_setting);
			mock_repository.save.mockImplementation((s: any) => Promise.resolve({...s}));

			// first encrypt it
			await service.updateSettings([SettingKey.AI_OPENROUTER_KEY], ['sk-or-v1-secret']);
			const saved = mock_repository.save.mock.calls[mock_repository.save.mock.calls.length - 1][0];

			// now read it back
			mock_repository.findOne.mockResolvedValue(saved);

			// act
			const result = await service.getSetting(SettingKey.AI_OPENROUTER_KEY);

			// assert
			expect(result.value).toBe('sk-or-v1-secret');
		});

		it('should return empty value when decryption fails (key rotation)', async () => {
			// arrange - simulate a value encrypted with a different key
			mock_config_service.get.mockImplementation((key: string) => {
				if (key === 'server.crypto_key') return 'ff'.repeat(32);
				if (key === 'server.setup_key') return undefined;
				return undefined;
			});
			await service.onModuleInit();
			const encrypted_with_old_key = {
				key: SettingKey.AI_OPENROUTER_KEY,
				value: 'enc:AAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAA==:AAAA',
				value_type: SettingValue.STRING,
				description: 'The OpenRouter API key',
			};
			mock_repository.findOne.mockResolvedValue(encrypted_with_old_key);

			// act
			const result = await service.getSetting(SettingKey.AI_OPENROUTER_KEY);

			// assert
			expect(result.value).toBe('');
		});

		it('should skip encryption when crypto_key is not configured', async () => {
			// arrange
			mock_config_service.get.mockImplementation(() => undefined);
			await service.onModuleInit();
			const sensitive_setting = {
				key: SettingKey.AI_OPENROUTER_KEY,
				value: '',
				value_type: SettingValue.STRING,
				description: 'The OpenRouter API key',
			};
			mock_repository.findOne.mockResolvedValue(sensitive_setting);
			mock_repository.save.mockImplementation((s: any) => Promise.resolve({...s}));

			// act
			await service.updateSettings([SettingKey.AI_OPENROUTER_KEY], ['sk-or-v1-plaintext']);

			// assert - stored as plaintext
			const saved = mock_repository.save.mock.calls[mock_repository.save.mock.calls.length - 1][0];
			expect(saved.value).toBe('sk-or-v1-plaintext');
		});
	});

	/* *******************************************************
		Encryption Migration
	******************************************************** */

	describe('encryption migration', () => {
		it('should re-encrypt settings from legacy SETUP_KEY to crypto key', async () => {
			// arrange - encrypt a value with the old SETUP_KEY-derived key
			const old_key = deriveEncryptionKey(test_setup_key);
			const old_encrypted = encryptValue('sk-or-v1-secret', old_key);
			const encrypted_setting = {
				key: SettingKey.AI_OPENROUTER_KEY,
				value: old_encrypted,
				value_type: SettingValue.STRING,
				description: 'The OpenRouter API key',
			};
			mock_repository.findOne.mockResolvedValue(null);
			mock_repository.find.mockResolvedValue([encrypted_setting]);
			mock_repository.create.mockReturnValue(mock_setting);
			mock_repository.save.mockImplementation((s: any) => Promise.resolve({...s}));

			// act
			await service.onModuleInit();

			// assert - the setting should have been re-encrypted with the new key
			const save_calls = mock_repository.save.mock.calls;
			const migration_saves = save_calls.filter((c: any) => c[0].key === SettingKey.AI_OPENROUTER_KEY);
			expect(migration_saves).toHaveLength(1);
			expect(isEncrypted(migration_saves[0][0].value)).toBe(true);
			expect(migration_saves[0][0].value).not.toBe(old_encrypted);
		});

		it('should skip migration when no SETUP_KEY is configured', async () => {
			// arrange
			mock_config_service.get.mockImplementation((key: string) => {
				if (key === 'server.crypto_key') return test_crypto_key;
				if (key === 'server.setup_key') return undefined;
				return undefined;
			});
			mock_repository.findOne.mockResolvedValue(null);
			mock_repository.find.mockResolvedValue([]);
			mock_repository.create.mockReturnValue(mock_setting);
			mock_repository.save.mockImplementation((s: any) => Promise.resolve({...s}));

			// act
			await service.onModuleInit();

			// assert - find should not have been called (migration skipped)
			expect(mock_repository.find).not.toHaveBeenCalled();
		});

		it('should gracefully handle decryption failure during migration', async () => {
			// arrange - a value encrypted with an unknown key
			const encrypted_setting = {
				key: SettingKey.AI_OPENROUTER_KEY,
				value: 'enc:AAAAAAAAAAAAAAAA:AAAAAAAAAAAAAAAAAAAAAA==:AAAA',
				value_type: SettingValue.STRING,
				description: 'The OpenRouter API key',
			};
			mock_repository.findOne.mockResolvedValue(null);
			mock_repository.find.mockResolvedValue([encrypted_setting]);
			mock_repository.create.mockReturnValue(mock_setting);
			mock_repository.save.mockImplementation((s: any) => Promise.resolve({...s}));

			// act - should not throw
			await service.onModuleInit();

			// assert - save should only be called for defaults, not for failed migration
			const save_calls = mock_repository.save.mock.calls;
			const migration_saves = save_calls.filter((c: any) => c[0].key === SettingKey.AI_OPENROUTER_KEY);
			expect(migration_saves).toHaveLength(0);
		});
	});
});
