/* Core Dependencies */
import {createHash, hkdfSync, randomBytes, createCipheriv, createDecipheriv} from 'crypto';
/* Local Dependencies */
import {Setting} from './setting.entity.js';
import {SettingKey, SettingSensitivity, SettingValue} from './setting.enums.js';

/**
 * Map of setting keys to their sensitivity level.
 * Settings not listed here default to NONE.
 */
export const SETTING_SENSITIVITY: Partial<Record<SettingKey, SettingSensitivity>> = {
	[SettingKey.AI_OPENROUTER_KEY]: SettingSensitivity.ALWAYS,
	[SettingKey.MESSAGES_TELEGRAM_BOT_TOKEN]: SettingSensitivity.ALWAYS,
};

/**
 * Determines whether a value looks like a file path.
 * Used for CONTENT sensitivity: file paths are NOT sensitive,
 * pasted content IS sensitive.
 * @param {string} value - The setting value to check
 * @returns {boolean} True if the value looks like a file path
 */
export const isFilePath = (value: string): boolean => {
	return /^[\/~.]/.test(value) || /^[A-Z]:\\/i.test(value);
};

/**
 * Get the sensitivity level for a setting key.
 * @param {SettingKey} key - The setting key
 * @returns {SettingSensitivity} The sensitivity level
 */
export const getSettingSensitivity = (key: SettingKey): SettingSensitivity => {
	return SETTING_SENSITIVITY[key] ?? SettingSensitivity.NONE;
};

/**
 * Determine whether a setting's value is currently sensitive,
 * taking into account the CONTENT level's file-path check.
 * @param {SettingKey} key - The setting key
 * @param {string} value - The current value
 * @returns {boolean} True if the value should be treated as sensitive
 */
export const isSettingSensitive = (key: SettingKey, value: string): boolean => {
	const sensitivity = getSettingSensitivity(key);
	if (sensitivity === SettingSensitivity.NONE) return false;
	if (sensitivity === SettingSensitivity.ALWAYS) return true;
	return !isFilePath(value);
};

/**
 * Mask a sensitive value for display.
 * Shows last 4 characters preceded by bullet dots.
 * @param {string} value - The plaintext value to mask
 * @returns {string} The masked value
 */
export const maskSensitiveValue = (value: string): string => {
	if (!value) return '';
	if (value.length <= 4) return '\u2022\u2022\u2022\u2022';
	return '\u2022\u2022\u2022\u2022' + value.slice(-4);
};

/* *******************************************************
	Parsing
******************************************************** */

/**
 * Parse a setting's string value into its typed representation based on value_type.
 * Mirrors the client-side parseSettingValue in SettingAppService.
 * @param {Setting} setting - The setting entity
 * @returns {boolean | number | string | any} The parsed value
 */
export const parseSettingValue = (setting: Setting): boolean | number | string | any => {
	switch (setting.value_type) {
		case SettingValue.BOOLEAN:
			return setting.value === 'true';
		case SettingValue.NUMBER:
			return Number(setting.value);
		case SettingValue.JSON:
			try {
				return JSON.parse(setting.value);
			} catch {
				return null;
			}
		case SettingValue.STRING:
		default:
			return setting.value;
	}
};

/* *******************************************************
	Encryption
******************************************************** */

const ENC_PREFIX = 'enc:';
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const HKDF_SALT = 'orchard-settings-encryption';
const HKDF_INFO = 'settings-encryption';
const CRYPTO_KEY_SALT = 'orchard-crypto-encryption';

/**
 * Derive a 256-bit key from raw key material using HKDF with the given salt.
 * @param {Buffer} material - Pre-processed key material
 * @param {string} salt - HKDF salt for domain separation
 * @returns {Buffer} 32-byte derived encryption key
 */
const deriveFromMaterial = (material: Buffer, salt: string): Buffer => {
	return Buffer.from(hkdfSync('sha256', material, salt, HKDF_INFO, 32));
};

/**
 * Derive a 256-bit encryption key from a secret string using HKDF.
 * Used for legacy migration from SETUP_KEY-based encryption.
 * @param {string} secret - The secret to derive from
 * @returns {Buffer} 32-byte derived encryption key
 */
export const deriveEncryptionKey = (secret: string): Buffer => {
	return deriveFromMaterial(createHash('sha256').update(secret).digest(), HKDF_SALT);
};

/**
 * Derive a 256-bit encryption key from a hex-encoded crypto key using HKDF.
 * @param {string} hex_key - Hex-encoded 32-byte crypto key (from data/crypto.key or CRYPTO_KEY env)
 * @returns {Buffer} 32-byte derived encryption key
 */
export const deriveEncryptionKeyFromHex = (hex_key: string): Buffer => {
	return deriveFromMaterial(Buffer.from(hex_key, 'hex'), CRYPTO_KEY_SALT);
};

/**
 * Encrypt a plaintext value using AES-256-GCM.
 * @param {string} plaintext - The value to encrypt
 * @param {Buffer} key - The 32-byte encryption key
 * @returns {string} Encrypted string in format: enc:<iv>:<authTag>:<ciphertext> (all base64)
 */
export const encryptValue = (plaintext: string, key: Buffer): string => {
	const iv = randomBytes(IV_LENGTH);
	const cipher = createCipheriv(ALGORITHM, key, iv, {authTagLength: AUTH_TAG_LENGTH});
	const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
	const auth_tag = cipher.getAuthTag();
	return `${ENC_PREFIX}${iv.toString('base64')}:${auth_tag.toString('base64')}:${encrypted.toString('base64')}`;
};

/**
 * Decrypt a value that was encrypted with encryptValue.
 * Returns non-enc: prefixed values as-is for backward compatibility.
 * @param {string} stored_value - The stored value (may be encrypted or plaintext)
 * @param {Buffer} key - The 32-byte encryption key
 * @returns {string} The decrypted plaintext
 */
export const decryptValue = (stored_value: string, key: Buffer): string => {
	if (!stored_value.startsWith(ENC_PREFIX)) return stored_value;
	const payload = stored_value.slice(ENC_PREFIX.length);
	const parts = payload.split(':');
	if (parts.length !== 3) return stored_value;
	const [iv_b64, tag_b64, ct_b64] = parts;
	const iv = Buffer.from(iv_b64, 'base64');
	const auth_tag = Buffer.from(tag_b64, 'base64');
	const ciphertext = Buffer.from(ct_b64, 'base64');
	const decipher = createDecipheriv(ALGORITHM, key, iv, {authTagLength: AUTH_TAG_LENGTH});
	decipher.setAuthTag(auth_tag);
	const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
	return decrypted.toString('utf8');
};

/**
 * Check whether a stored value is encrypted.
 * @param {string} value - The stored value
 * @returns {boolean} True if the value has the encryption prefix
 */
export const isEncrypted = (value: string): boolean => {
	return value.startsWith(ENC_PREFIX);
};
