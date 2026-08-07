/* Core Dependencies */
import {Injectable, Logger, OnModuleInit} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {ConfigService} from '@nestjs/config';
/* Vendor Dependencies */
import {EntityManager, Repository} from 'typeorm';
/* Local Dependencies */
import {Setting} from './setting.entity.js';
import {DEFAULT_SETTINGS} from './setting.config.js';
import {SettingKey} from './setting.enums.js';
import {
	isSettingSensitive,
	isEncrypted,
	maskSensitiveValue,
	deriveEncryptionKey,
	deriveEncryptionKeyFromHex,
	encryptValue,
	decryptValue,
	parseSettingValue,
} from './setting.helpers.js';

@Injectable()
export class SettingService implements OnModuleInit {
	private readonly logger = new Logger(SettingService.name);
	private encryption_key: Buffer | null = null;

	constructor(
		@InjectRepository(Setting)
		private settingRepository: Repository<Setting>,
		private configService: ConfigService,
	) {}

	/**
	 * Initialize default settings on module startup
	 * This ensures all required settings exist in the database
	 */
	async onModuleInit(): Promise<void> {
		if (process.env.SCHEMA_ONLY) return;
		this.initializeEncryption();
		await this.migrateEncryptionIfNeeded();
		await this.initializeDefaults();
	}

	/* *******************************************************
		Initialization
	******************************************************** */

	/**
	 * Derive the encryption key from the persisted crypto key
	 */
	private initializeEncryption(): void {
		const crypto_key = this.configService.get<string>('server.crypto_key');
		if (crypto_key) {
			this.encryption_key = deriveEncryptionKeyFromHex(crypto_key);
			this.logger.debug('Setting encryption initialized');
		} else {
			this.logger.warn('No crypto key available; sensitive settings will not be encrypted at rest');
		}
	}

	/**
	 * One-time migration of encrypted settings from legacy SETUP_KEY derivation
	 * to the new persisted crypto key.
	 */
	private async migrateEncryptionIfNeeded(): Promise<void> {
		if (!this.encryption_key) return;

		const setup_key = this.configService.get<string>('server.setup_key');
		if (!setup_key) return;

		const old_key = deriveEncryptionKey(setup_key);
		if (old_key.equals(this.encryption_key)) return;

		const all_settings = await this.settingRepository.find();
		const encrypted_settings = all_settings.filter((s) => s.value && isEncrypted(s.value));
		if (encrypted_settings.length === 0) return;

		let migrated = 0;
		for (const setting of encrypted_settings) {
			if (this.tryDecrypt(setting.value, this.encryption_key)) continue;

			const plaintext = this.tryDecrypt(setting.value, old_key);
			if (!plaintext) {
				this.logger.warn(`Failed to migrate encryption for setting [${setting.key}]`);
				continue;
			}

			setting.value = encryptValue(plaintext, this.encryption_key);
			await this.settingRepository.save(setting);
			migrated++;
		}

		if (migrated > 0) {
			this.logger.log(`Migrated ${migrated} encrypted setting(s) to crypto key`);
		}
	}

	/**
	 * Attempt to decrypt a value, returning the plaintext or null on failure.
	 * @param {string} value - The encrypted value
	 * @param {Buffer} key - The decryption key
	 * @returns {string | null} Decrypted plaintext, or null if decryption fails
	 */
	private tryDecrypt(value: string, key: Buffer): string | null {
		try {
			return decryptValue(value, key);
		} catch {
			return null;
		}
	}

	/**
	 * Initialize default settings if they don't exist
	 * @returns {Promise<void>}
	 */
	private async initializeDefaults(): Promise<void> {
		for (const default_setting of DEFAULT_SETTINGS) {
			const existing = await this.settingRepository.findOne({
				where: {key: default_setting.key},
			});
			if (existing) continue;
			const setting = this.settingRepository.create({
				key: default_setting.key,
				value: default_setting.value,
				value_type: default_setting.value_type,
				description: default_setting.description,
			});
			await this.settingRepository.save(setting);
			this.logger.debug(`Initialized default setting: ${default_setting.key}`);
		}
	}

	/* *******************************************************
		Read
	******************************************************** */

	/**
	 * Get all settings
	 * @returns {Promise<Setting[]>} All settings with decrypted values
	 */
	public async getSettings(): Promise<Setting[]> {
		const valid_keys = new Set(Object.values(SettingKey));
		const settings = await this.settingRepository.find();
		return settings.filter((s) => valid_keys.has(s.key)).map((s) => this.decryptSetting(s));
	}

	/**
	 * Get a setting by key
	 * @param {SettingKey} key - The setting key to get
	 * @returns {Promise<Setting>} The setting with decrypted value
	 */
	public async getSetting(key: SettingKey): Promise<Setting> {
		const setting = await this.settingRepository.findOne({where: {key}});
		return setting ? this.decryptSetting(setting) : setting;
	}

	/**
	 * Get a boolean setting by key
	 * @param {SettingKey} key - The setting key to get
	 * @returns {Promise<boolean>} The parsed boolean value, false if missing or empty
	 */
	public async getBooleanSetting(key: SettingKey): Promise<boolean> {
		const setting = await this.getSetting(key);
		if (!setting?.value) return false;
		return parseSettingValue(setting) === true;
	}

	/**
	 * Get a string setting by key
	 * @param {SettingKey} key - The setting key to get
	 * @returns {Promise<string | null>} The string value, null if missing or empty
	 */
	public async getStringSetting(key: SettingKey): Promise<string | null> {
		const setting = await this.getSetting(key);
		if (!setting?.value) return null;
		return String(parseSettingValue(setting)) || null;
	}

	/**
	 * Get a number setting by key
	 * @param {SettingKey} key - The setting key to get
	 * @returns {Promise<number | null>} The parsed number value, null if missing, empty, or NaN
	 */
	public async getNumberSetting(key: SettingKey): Promise<number | null> {
		const setting = await this.getSetting(key);
		if (!setting?.value) return null;
		const parsed = parseSettingValue(setting);
		return typeof parsed === 'number' && !isNaN(parsed) ? parsed : null;
	}

	/* *******************************************************
		Write
	******************************************************** */

	/**
	 * Update multiple settings by key
	 * @param {SettingKey[]} keys - The setting keys to update
	 * @param {string[]} values - The new values for the settings
	 * @returns {Promise<Setting[]>} The updated settings with decrypted values
	 */
	public async updateSettings(keys: SettingKey[], values: string[]): Promise<Setting[]> {
		return this.settingRepository.manager.transaction(async (manager) => {
			const results: Setting[] = [];
			for (let i = 0; i < keys.length; i++) {
				results.push(await this.updateSetting(keys[i], values[i], manager));
			}
			return results;
		});
	}

	/**
	 * Update a setting by key
	 * @param {SettingKey} key - The setting key to update
	 * @param {string} value - The new value for the setting
	 * @param {EntityManager} manager - Optional transactional entity manager
	 * @returns {Promise<Setting>} The updated setting with decrypted value
	 */
	private async updateSetting(key: SettingKey, value: string, manager?: EntityManager): Promise<Setting> {
		const repo = manager ? manager.getRepository(Setting) : this.settingRepository;
		const setting = await repo.findOne({
			where: {key},
		});
		if (!setting) throw new Error(`Setting with key ${key} not found`);
		setting.value = this.encryptIfSensitive(key, value);
		const updated_setting = await repo.save(setting);
		const log_value = isSettingSensitive(key, value) ? maskSensitiveValue(value) : value;
		this.logger.debug(`Updated setting: ${key} = ${log_value}`);
		return this.decryptSetting(updated_setting);
	}

	/* *******************************************************
		Encryption
	******************************************************** */

	/**
	 * Decrypt a setting's value if it is encrypted.
	 * On decryption failure (e.g. key rotation), returns empty value and logs a warning.
	 * @param {Setting} setting - The setting from the database
	 * @returns {Setting} A copy with decrypted value
	 */
	private decryptSetting(setting: Setting): Setting {
		if (!this.encryption_key) return setting;
		try {
			return {
				...setting,
				value: decryptValue(setting.value, this.encryption_key),
			};
		} catch (_error) {
			this.logger.warn(`Failed to decrypt setting [${setting.key}]; value may need to be re-entered`);
			return {...setting, value: ''};
		}
	}

	/**
	 * Encrypt a value if the setting is sensitive and encryption is available.
	 * Empty values are not encrypted.
	 * @param {SettingKey} key - The setting key
	 * @param {string} value - The plaintext value
	 * @returns {string} The encrypted value or the original value
	 */
	private encryptIfSensitive(key: SettingKey, value: string): string {
		if (!this.encryption_key) return value;
		if (!value) return value;
		if (!isSettingSensitive(key, value)) return value;
		return encryptValue(value, this.encryption_key);
	}
}
