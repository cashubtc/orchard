/* Core Dependencies */
import {expect} from '@jest/globals';
import {existsSync, readFileSync, writeFileSync, mkdtempSync, rmSync, statSync} from 'fs';
import {join} from 'path';
import {tmpdir} from 'os';
import {createHash} from 'crypto';
import {Test, TestingModule} from '@nestjs/testing';
import {ConfigService} from '@nestjs/config';
import {getRepositoryToken} from '@nestjs/typeorm';
/* Local Dependencies */
import {loadOrCreateCryptoKey, generateEphemeralJwtSecret, getCryptoKeyPath} from './crypto-key.js';
import {SettingService} from '@server/modules/setting/setting.service';
import {Setting} from '@server/modules/setting/setting.entity';
import {SettingKey, SettingValue} from '@server/modules/setting/setting.enums';
import {DEFAULT_SETTINGS} from '@server/modules/setting/setting.config';
import {
	deriveEncryptionKey,
	deriveEncryptionKeyFromHex,
	encryptValue,
	decryptValue,
	isEncrypted,
} from '@server/modules/setting/setting.helpers';

/**
 * Integration tests for the crypto-keys feature.
 * Covers key lifecycle, settings encryption, migration, and JWT secret behavior.
 */
describe('Crypto Key Integration', () => {
	const original_env = {...process.env};
	let test_dir: string;

	beforeEach(() => {
		process.env = {...original_env};
		delete process.env.CRYPTO_KEY;
		delete process.env.DATABASE_DIR;
		test_dir = mkdtempSync(join(tmpdir(), 'orchard-crypto-int-'));
		process.env.DATABASE_DIR = test_dir;
	});

	afterEach(() => {
		process.env = original_env;
		rmSync(test_dir, {recursive: true, force: true});
	});

	/* *******************************************************
		1. Crypto Key Lifecycle
	******************************************************** */

	describe('key lifecycle', () => {
		it('should create a new key file on first boot', () => {
			const key = loadOrCreateCryptoKey();
			const key_path = join(test_dir, 'crypto.key');

			expect(key).toHaveLength(64);
			expect(/^[0-9a-f]{64}$/.test(key)).toBe(true);
			expect(existsSync(key_path)).toBe(true);
			expect(readFileSync(key_path, 'utf8').trim()).toBe(key);
		});

		it('should set restrictive file permissions on the key file', () => {
			loadOrCreateCryptoKey();
			const key_path = join(test_dir, 'crypto.key');
			const stats = statSync(key_path);
			const mode = (stats.mode & 0o777).toString(8);
			expect(mode).toBe('600');
		});

		it('should return the same key on subsequent boots', () => {
			const key1 = loadOrCreateCryptoKey();
			const key2 = loadOrCreateCryptoKey();
			expect(key1).toBe(key2);
		});

		it('should prefer CRYPTO_KEY env var over file', () => {
			// first create a file-based key
			const file_key = loadOrCreateCryptoKey();

			// now set env var and verify it takes priority
			process.env.CRYPTO_KEY = 'my-env-passphrase';
			const env_key = loadOrCreateCryptoKey();

			expect(env_key).not.toBe(file_key);
			expect(env_key).toBe(createHash('sha256').update('my-env-passphrase').digest('hex'));
		});

		it('should not create a file when CRYPTO_KEY env var is set', () => {
			const empty_dir = mkdtempSync(join(tmpdir(), 'orchard-crypto-nofile-'));
			process.env.DATABASE_DIR = empty_dir;
			process.env.CRYPTO_KEY = 'env-only';

			loadOrCreateCryptoKey();

			const key_path = join(empty_dir, 'crypto.key');
			expect(existsSync(key_path)).toBe(false);
			rmSync(empty_dir, {recursive: true, force: true});
		});

		it('should produce deterministic keys from the same CRYPTO_KEY env var', () => {
			process.env.CRYPTO_KEY = 'stable-passphrase';
			const key1 = loadOrCreateCryptoKey();

			// simulate restart
			process.env.CRYPTO_KEY = 'stable-passphrase';
			const key2 = loadOrCreateCryptoKey();

			expect(key1).toBe(key2);
		});

		it('should produce different keys for different CRYPTO_KEY values', () => {
			process.env.CRYPTO_KEY = 'passphrase-a';
			const key_a = loadOrCreateCryptoKey();

			process.env.CRYPTO_KEY = 'passphrase-b';
			const key_b = loadOrCreateCryptoKey();

			expect(key_a).not.toBe(key_b);
		});

		it('should use DATABASE_DIR for key file location', () => {
			const custom_dir = mkdtempSync(join(tmpdir(), 'orchard-crypto-custom-'));
			process.env.DATABASE_DIR = custom_dir;

			expect(getCryptoKeyPath()).toBe(join(custom_dir, 'crypto.key'));

			loadOrCreateCryptoKey();
			expect(existsSync(join(custom_dir, 'crypto.key'))).toBe(true);

			rmSync(custom_dir, {recursive: true, force: true});
		});

		it('should throw when data directory does not exist', () => {
			process.env.DATABASE_DIR = join(test_dir, 'nonexistent', 'deep', 'path');
			expect(() => loadOrCreateCryptoKey()).toThrow();
		});

		it('should handle race condition via wx flag (EEXIST)', () => {
			// simulate another process having already written the file
			const key_path = join(test_dir, 'crypto.key');
			const race_key = 'cc'.repeat(32);
			writeFileSync(key_path, race_key + '\n');

			const key = loadOrCreateCryptoKey();
			expect(key).toBe(race_key);
		});
	});

	/* *******************************************************
		2. JWT Ephemeral Secret
	******************************************************** */

	describe('ephemeral JWT secret', () => {
		it('should generate unique secrets per call (simulating restarts)', () => {
			const secrets = new Set<string>();
			for (let i = 0; i < 10; i++) {
				secrets.add(generateEphemeralJwtSecret());
			}
			expect(secrets.size).toBe(10);
		});

		it('should generate 128-char hex strings (64 bytes entropy)', () => {
			const secret = generateEphemeralJwtSecret();
			expect(secret).toHaveLength(128);
			expect(/^[0-9a-f]{128}$/.test(secret)).toBe(true);
		});

		it('should not collide with crypto key', () => {
			const crypto_key = loadOrCreateCryptoKey();
			const jwt_secret = generateEphemeralJwtSecret();
			expect(jwt_secret).not.toBe(crypto_key);
		});
	});

	/* *******************************************************
		3. Key Derivation Domain Separation
	******************************************************** */

	describe('key derivation domain separation', () => {
		it('should derive different encryption keys from legacy vs crypto key paths', () => {
			const secret = 'shared-input';
			const hex_key = createHash('sha256').update(secret).digest('hex');

			const legacy_derived = deriveEncryptionKey(secret);
			const crypto_derived = deriveEncryptionKeyFromHex(hex_key);

			expect(legacy_derived.equals(crypto_derived)).toBe(false);
		});

		it('should derive a consistent key from the same crypto key across calls', () => {
			const hex_key = 'ab'.repeat(32);
			const key1 = deriveEncryptionKeyFromHex(hex_key);
			const key2 = deriveEncryptionKeyFromHex(hex_key);
			expect(key1.equals(key2)).toBe(true);
		});

		it('should produce valid 32-byte keys for AES-256', () => {
			const hex_key = loadOrCreateCryptoKey();
			const derived = deriveEncryptionKeyFromHex(hex_key);
			expect(derived).toBeInstanceOf(Buffer);
			expect(derived.length).toBe(32);
		});
	});

	/* *******************************************************
		4. Settings Encryption with Crypto Key
	******************************************************** */

	describe('settings encryption end-to-end', () => {
		let service: SettingService;
		let mock_repository: any;
		let mock_config_service: any;
		let stored_settings: Map<string, Setting>;

		/** Build a fresh SettingService wired to in-memory storage */
		const buildService = async (crypto_key: string | undefined, setup_key: string | undefined) => {
			stored_settings = new Map();

			mock_repository = {
				findOne: jest.fn().mockImplementation(({where}: any) => {
					return Promise.resolve(stored_settings.get(where.key) ?? null);
				}),
				find: jest.fn().mockImplementation(() => {
					return Promise.resolve([...stored_settings.values()]);
				}),
				create: jest.fn().mockImplementation((data: any) => ({...data})),
				save: jest.fn().mockImplementation((setting: any) => {
					stored_settings.set(setting.key, {...setting});
					return Promise.resolve({...setting});
				}),
				manager: {
					transaction: jest.fn((cb: any) => cb({getRepository: () => mock_repository})),
				},
			};

			mock_config_service = {
				get: jest.fn().mockImplementation((key: string) => {
					if (key === 'server.crypto_key') return crypto_key;
					if (key === 'server.setup_key') return setup_key;
					return undefined;
				}),
			};

			const module: TestingModule = await Test.createTestingModule({
				providers: [
					SettingService,
					{provide: getRepositoryToken(Setting), useValue: mock_repository},
					{provide: ConfigService, useValue: mock_config_service},
				],
			}).compile();

			service = module.get<SettingService>(SettingService);
			await service.onModuleInit();
			return service;
		};

		it('should encrypt sensitive settings and decrypt them on read', async () => {
			const crypto_key = loadOrCreateCryptoKey();
			await buildService(crypto_key, undefined);

			// write a sensitive setting
			await service.updateSettings([SettingKey.AI_OPENROUTER_KEY], ['sk-or-v1-live-key-123']);

			// verify it's stored encrypted
			const raw = stored_settings.get(SettingKey.AI_OPENROUTER_KEY);
			expect(raw).toBeDefined();
			expect(isEncrypted(raw!.value)).toBe(true);
			expect(raw!.value).not.toContain('sk-or-v1-live-key-123');

			// verify it decrypts on read
			const result = await service.getSetting(SettingKey.AI_OPENROUTER_KEY);
			expect(result.value).toBe('sk-or-v1-live-key-123');
		});

		it('should not encrypt non-sensitive settings', async () => {
			const crypto_key = loadOrCreateCryptoKey();
			await buildService(crypto_key, undefined);

			await service.updateSettings([SettingKey.AI_VENDOR], ['openrouter']);

			const raw = stored_settings.get(SettingKey.AI_VENDOR);
			expect(raw!.value).toBe('openrouter');
			expect(isEncrypted(raw!.value)).toBe(false);
		});

		it('should not encrypt empty sensitive values', async () => {
			const crypto_key = loadOrCreateCryptoKey();
			await buildService(crypto_key, undefined);

			await service.updateSettings([SettingKey.AI_OPENROUTER_KEY], ['']);

			const raw = stored_settings.get(SettingKey.AI_OPENROUTER_KEY);
			expect(raw!.value).toBe('');
		});

		it('should store plaintext when no crypto key is configured', async () => {
			await buildService(undefined, undefined);

			await service.updateSettings([SettingKey.AI_OPENROUTER_KEY], ['sk-or-v1-plaintext']);

			const raw = stored_settings.get(SettingKey.AI_OPENROUTER_KEY);
			expect(raw!.value).toBe('sk-or-v1-plaintext');
			expect(isEncrypted(raw!.value)).toBe(false);
		});

		it('should return empty string when decryption fails (wrong key)', async () => {
			// encrypt with one key
			const key_a = 'aa'.repeat(32);
			await buildService(key_a, undefined);
			await service.updateSettings([SettingKey.AI_OPENROUTER_KEY], ['secret-value']);

			// read with a different key
			const key_b = 'bb'.repeat(32);
			await buildService(key_b, undefined);

			// manually put the old encrypted value back
			const old_encrypted = stored_settings.get(SettingKey.AI_OPENROUTER_KEY);

			// re-init with key_b and the old ciphertext
			await buildService(key_b, undefined);
			stored_settings.set(SettingKey.AI_OPENROUTER_KEY, old_encrypted!);

			const result = await service.getSetting(SettingKey.AI_OPENROUTER_KEY);
			expect(result.value).toBe('');
		});

		it('should handle multiple sensitive settings independently', async () => {
			const crypto_key = loadOrCreateCryptoKey();
			await buildService(crypto_key, undefined);

			await service.updateSettings(
				[SettingKey.AI_OPENROUTER_KEY, SettingKey.MESSAGES_TELEGRAM_BOT_TOKEN],
				['sk-or-key', '123:BotToken'],
			);

			const raw_or = stored_settings.get(SettingKey.AI_OPENROUTER_KEY);
			const raw_tg = stored_settings.get(SettingKey.MESSAGES_TELEGRAM_BOT_TOKEN);
			expect(isEncrypted(raw_or!.value)).toBe(true);
			expect(isEncrypted(raw_tg!.value)).toBe(true);

			// different ciphertexts (random IVs)
			expect(raw_or!.value).not.toBe(raw_tg!.value);

			// both decrypt correctly
			const result_or = await service.getSetting(SettingKey.AI_OPENROUTER_KEY);
			const result_tg = await service.getSetting(SettingKey.MESSAGES_TELEGRAM_BOT_TOKEN);
			expect(result_or.value).toBe('sk-or-key');
			expect(result_tg.value).toBe('123:BotToken');
		});
	});

	/* *******************************************************
		5. Encryption Migration (SETUP_KEY → crypto key)
	******************************************************** */

	describe('encryption migration', () => {
		let service: SettingService;
		let mock_repository: any;
		let stored_settings: Map<string, Setting>;

		const buildService = async (crypto_key: string | undefined, setup_key: string | undefined) => {
			stored_settings = stored_settings ?? new Map();

			mock_repository = {
				findOne: jest.fn().mockImplementation(({where}: any) => {
					return Promise.resolve(stored_settings.get(where.key) ?? null);
				}),
				find: jest.fn().mockImplementation(() => {
					return Promise.resolve([...stored_settings.values()]);
				}),
				create: jest.fn().mockImplementation((data: any) => ({...data})),
				save: jest.fn().mockImplementation((setting: any) => {
					stored_settings.set(setting.key, {...setting});
					return Promise.resolve({...setting});
				}),
				manager: {
					transaction: jest.fn((cb: any) => cb({getRepository: () => mock_repository})),
				},
			};

			const mock_config_service = {
				get: jest.fn().mockImplementation((key: string) => {
					if (key === 'server.crypto_key') return crypto_key;
					if (key === 'server.setup_key') return setup_key;
					return undefined;
				}),
			};

			const module: TestingModule = await Test.createTestingModule({
				providers: [
					SettingService,
					{provide: getRepositoryToken(Setting), useValue: mock_repository},
					{provide: ConfigService, useValue: mock_config_service},
				],
			}).compile();

			service = module.get<SettingService>(SettingService);
			await service.onModuleInit();
			return service;
		};

		beforeEach(() => {
			stored_settings = new Map();
		});

		it('should re-encrypt settings from legacy SETUP_KEY to crypto key', async () => {
			const setup_key = 'my-setup-password';
			const crypto_key = loadOrCreateCryptoKey();

			// simulate legacy state: encrypt with SETUP_KEY-derived key
			const old_enc_key = deriveEncryptionKey(setup_key);
			const old_ciphertext = encryptValue('sk-or-v1-real-secret', old_enc_key);

			stored_settings.set(SettingKey.AI_OPENROUTER_KEY, {
				key: SettingKey.AI_OPENROUTER_KEY,
				value: old_ciphertext,
				value_type: SettingValue.STRING,
				description: 'The OpenRouter API key',
			});

			// boot with both keys — migration should happen
			await buildService(crypto_key, setup_key);

			// verify the stored value changed (re-encrypted)
			const migrated = stored_settings.get(SettingKey.AI_OPENROUTER_KEY)!;
			expect(isEncrypted(migrated.value)).toBe(true);
			expect(migrated.value).not.toBe(old_ciphertext);

			// verify it decrypts correctly with the new key
			const new_enc_key = deriveEncryptionKeyFromHex(crypto_key);
			const decrypted = decryptValue(migrated.value, new_enc_key);
			expect(decrypted).toBe('sk-or-v1-real-secret');
		});

		it('should migrate multiple encrypted settings at once', async () => {
			const setup_key = 'legacy-key';
			const crypto_key = loadOrCreateCryptoKey();
			const old_enc_key = deriveEncryptionKey(setup_key);

			stored_settings.set(SettingKey.AI_OPENROUTER_KEY, {
				key: SettingKey.AI_OPENROUTER_KEY,
				value: encryptValue('or-secret', old_enc_key),
				value_type: SettingValue.STRING,
				description: 'The OpenRouter API key',
			});
			stored_settings.set(SettingKey.MESSAGES_TELEGRAM_BOT_TOKEN, {
				key: SettingKey.MESSAGES_TELEGRAM_BOT_TOKEN,
				value: encryptValue('tg-secret', old_enc_key),
				value_type: SettingValue.STRING,
				description: 'The Telegram bot token from @BotFather',
			});
			// non-encrypted setting should be untouched
			stored_settings.set(SettingKey.AI_VENDOR, {
				key: SettingKey.AI_VENDOR,
				value: 'ollama',
				value_type: SettingValue.STRING,
				description: 'The AI vendor',
			});

			await buildService(crypto_key, setup_key);

			const new_enc_key = deriveEncryptionKeyFromHex(crypto_key);
			expect(decryptValue(stored_settings.get(SettingKey.AI_OPENROUTER_KEY)!.value, new_enc_key)).toBe('or-secret');
			expect(decryptValue(stored_settings.get(SettingKey.MESSAGES_TELEGRAM_BOT_TOKEN)!.value, new_enc_key)).toBe('tg-secret');
			expect(stored_settings.get(SettingKey.AI_VENDOR)!.value).toBe('ollama');
		});

		it('should be idempotent — skip already-migrated settings on second run', async () => {
			const setup_key = 'legacy-key';
			const crypto_key = loadOrCreateCryptoKey();
			const old_enc_key = deriveEncryptionKey(setup_key);

			stored_settings.set(SettingKey.AI_OPENROUTER_KEY, {
				key: SettingKey.AI_OPENROUTER_KEY,
				value: encryptValue('my-secret', old_enc_key),
				value_type: SettingValue.STRING,
				description: 'The OpenRouter API key',
			});

			// first boot — migrates
			await buildService(crypto_key, setup_key);
			const after_first_boot = stored_settings.get(SettingKey.AI_OPENROUTER_KEY)!.value;

			// second boot — should NOT re-encrypt
			await buildService(crypto_key, setup_key);
			const after_second_boot = stored_settings.get(SettingKey.AI_OPENROUTER_KEY)!.value;

			expect(after_second_boot).toBe(after_first_boot);
		});

		it('should skip migration when no SETUP_KEY is configured', async () => {
			const crypto_key = loadOrCreateCryptoKey();
			await buildService(crypto_key, undefined);

			// find() should not be called for migration when setup_key is absent
			expect(mock_repository.find).not.toHaveBeenCalled();
		});

		it('should skip migration when no crypto key is available', async () => {
			await buildService(undefined, 'some-setup-key');

			// find() should not be called for migration when encryption_key is null
			expect(mock_repository.find).not.toHaveBeenCalled();
		});

		it('should gracefully handle settings encrypted with an unknown key', async () => {
			const crypto_key = loadOrCreateCryptoKey();

			// encrypt with a completely unrelated key
			const unknown_key = deriveEncryptionKey('unknown-source');
			stored_settings.set(SettingKey.AI_OPENROUTER_KEY, {
				key: SettingKey.AI_OPENROUTER_KEY,
				value: encryptValue('orphaned-secret', unknown_key),
				value_type: SettingValue.STRING,
				description: 'The OpenRouter API key',
			});

			// should not throw
			await buildService(crypto_key, 'some-setup-key');

			// the setting should remain unchanged (not migrated)
			const raw = stored_settings.get(SettingKey.AI_OPENROUTER_KEY)!;
			expect(isEncrypted(raw.value)).toBe(true);
		});

		it('should migrate some settings even if others fail', async () => {
			const setup_key = 'legacy-key';
			const crypto_key = loadOrCreateCryptoKey();
			const old_enc_key = deriveEncryptionKey(setup_key);
			const unknown_key = deriveEncryptionKey('unknown-source');

			// one valid legacy setting
			stored_settings.set(SettingKey.AI_OPENROUTER_KEY, {
				key: SettingKey.AI_OPENROUTER_KEY,
				value: encryptValue('good-secret', old_enc_key),
				value_type: SettingValue.STRING,
				description: 'The OpenRouter API key',
			});
			// one setting encrypted with unknown key
			stored_settings.set(SettingKey.MESSAGES_TELEGRAM_BOT_TOKEN, {
				key: SettingKey.MESSAGES_TELEGRAM_BOT_TOKEN,
				value: encryptValue('bad-secret', unknown_key),
				value_type: SettingValue.STRING,
				description: 'The Telegram bot token',
			});

			await buildService(crypto_key, setup_key);

			// the good one should be migrated
			const new_enc_key = deriveEncryptionKeyFromHex(crypto_key);
			expect(decryptValue(stored_settings.get(SettingKey.AI_OPENROUTER_KEY)!.value, new_enc_key)).toBe('good-secret');
		});

		it('should preserve plaintext settings during migration', async () => {
			const setup_key = 'legacy-key';
			const crypto_key = loadOrCreateCryptoKey();

			stored_settings.set(SettingKey.AI_VENDOR, {
				key: SettingKey.AI_VENDOR,
				value: 'openrouter',
				value_type: SettingValue.STRING,
				description: 'The AI vendor',
			});
			stored_settings.set(SettingKey.BITCOIN_ORACLE, {
				key: SettingKey.BITCOIN_ORACLE,
				value: 'true',
				value_type: SettingValue.BOOLEAN,
				description: 'Oracle enabled',
			});

			await buildService(crypto_key, setup_key);

			expect(stored_settings.get(SettingKey.AI_VENDOR)!.value).toBe('openrouter');
			expect(stored_settings.get(SettingKey.BITCOIN_ORACLE)!.value).toBe('true');
		});
	});

	/* *******************************************************
		6. Configuration Integration
	******************************************************** */

	describe('configuration integration', () => {
		it('should produce three distinct key materials', () => {
			const crypto_key = loadOrCreateCryptoKey();
			const jwt_secret = generateEphemeralJwtSecret();
			const settings_enc_key = deriveEncryptionKeyFromHex(crypto_key);

			// all three should be different
			expect(crypto_key).not.toBe(jwt_secret);
			expect(crypto_key).not.toBe(settings_enc_key.toString('hex'));
			expect(jwt_secret).not.toBe(settings_enc_key.toString('hex'));
		});

		it('should keep crypto key stable while JWT secret changes per boot', () => {
			const crypto_key_1 = loadOrCreateCryptoKey();
			const jwt_1 = generateEphemeralJwtSecret();

			const crypto_key_2 = loadOrCreateCryptoKey();
			const jwt_2 = generateEphemeralJwtSecret();

			expect(crypto_key_1).toBe(crypto_key_2);
			expect(jwt_1).not.toBe(jwt_2);
		});

		it('should initialize default settings during onModuleInit', async () => {
			const crypto_key = loadOrCreateCryptoKey();
			const stored: Map<string, Setting> = new Map();

			const mock_repo = {
				findOne: jest.fn().mockImplementation(({where}: any) => Promise.resolve(stored.get(where.key) ?? null)),
				find: jest.fn().mockImplementation(() => Promise.resolve([...stored.values()])),
				create: jest.fn().mockImplementation((data: any) => ({...data})),
				save: jest.fn().mockImplementation((setting: any) => {
					stored.set(setting.key, {...setting});
					return Promise.resolve({...setting});
				}),
				manager: {transaction: jest.fn((cb: any) => cb({getRepository: () => mock_repo}))},
			};

			const module: TestingModule = await Test.createTestingModule({
				providers: [
					SettingService,
					{provide: getRepositoryToken(Setting), useValue: mock_repo},
					{
						provide: ConfigService,
						useValue: {
							get: jest.fn().mockImplementation((key: string) => {
								if (key === 'server.crypto_key') return crypto_key;
								return undefined;
							}),
						},
					},
				],
			}).compile();

			const svc = module.get<SettingService>(SettingService);
			await svc.onModuleInit();

			expect(stored.size).toBe(DEFAULT_SETTINGS.length);
			for (const ds of DEFAULT_SETTINGS) {
				expect(stored.has(ds.key)).toBe(true);
			}
		});
	});

	/* *******************************************************
		7. Cross-Cutting Encryption Round-Trip
	******************************************************** */

	describe('full encryption round-trip with real crypto key', () => {
		it('should encrypt with file-based key, survive simulated restart, and decrypt', () => {
			// boot 1: generate key and encrypt
			const crypto_key = loadOrCreateCryptoKey();
			const enc_key = deriveEncryptionKeyFromHex(crypto_key);
			const ciphertext = encryptValue('api-key-value-12345', enc_key);

			expect(isEncrypted(ciphertext)).toBe(true);

			// boot 2: reload key from file and decrypt
			const crypto_key_2 = loadOrCreateCryptoKey();
			expect(crypto_key_2).toBe(crypto_key);

			const enc_key_2 = deriveEncryptionKeyFromHex(crypto_key_2);
			const plaintext = decryptValue(ciphertext, enc_key_2);

			expect(plaintext).toBe('api-key-value-12345');
		});

		it('should encrypt with env-based key, survive simulated restart, and decrypt', () => {
			process.env.CRYPTO_KEY = 'docker-env-secret';

			const crypto_key = loadOrCreateCryptoKey();
			const enc_key = deriveEncryptionKeyFromHex(crypto_key);
			const ciphertext = encryptValue('telegram-bot-token', enc_key);

			// simulate restart with same env
			const crypto_key_2 = loadOrCreateCryptoKey();
			const enc_key_2 = deriveEncryptionKeyFromHex(crypto_key_2);
			const plaintext = decryptValue(ciphertext, enc_key_2);

			expect(plaintext).toBe('telegram-bot-token');
		});

		it('should fail to decrypt after crypto key file is replaced', () => {
			const crypto_key = loadOrCreateCryptoKey();
			const enc_key = deriveEncryptionKeyFromHex(crypto_key);
			const ciphertext = encryptValue('secret-data', enc_key);

			// replace the key file (simulating accidental deletion + regen)
			const key_path = join(test_dir, 'crypto.key');
			const new_key = 'dd'.repeat(32);
			writeFileSync(key_path, new_key + '\n');

			const crypto_key_2 = loadOrCreateCryptoKey();
			expect(crypto_key_2).toBe(new_key);
			expect(crypto_key_2).not.toBe(crypto_key);

			const enc_key_2 = deriveEncryptionKeyFromHex(crypto_key_2);
			expect(() => decryptValue(ciphertext, enc_key_2)).toThrow();
		});
	});
});
