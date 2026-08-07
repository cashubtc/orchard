/* Core Dependencies */
import {expect} from '@jest/globals';
/* Local Dependencies */
import {SettingKey, SettingSensitivity, SettingValue} from './setting.enums.js';
import {
	SETTING_SENSITIVITY,
	isFilePath,
	getSettingSensitivity,
	isSettingSensitive,
	maskSensitiveValue,
	parseSettingValue,
	deriveEncryptionKey,
	deriveEncryptionKeyFromHex,
	encryptValue,
	decryptValue,
	isEncrypted,
} from './setting.helpers.js';

/**
 * Test suite for setting helpers
 * Tests sensitivity classification, masking, and encryption utilities
 */
describe('Setting Helpers', () => {
	/* *******************************************************
		Sensitivity
	******************************************************** */

	describe('SETTING_SENSITIVITY', () => {
		it('should mark AI_OPENROUTER_KEY as ALWAYS sensitive', () => {
			expect(SETTING_SENSITIVITY[SettingKey.AI_OPENROUTER_KEY]).toBe(SettingSensitivity.ALWAYS);
		});

		it('should mark MESSAGES_TELEGRAM_BOT_TOKEN as ALWAYS sensitive', () => {
			expect(SETTING_SENSITIVITY[SettingKey.MESSAGES_TELEGRAM_BOT_TOKEN]).toBe(SettingSensitivity.ALWAYS);
		});

		it('should not include non-sensitive keys', () => {
			expect(SETTING_SENSITIVITY[SettingKey.BITCOIN_ORACLE]).toBeUndefined();
			expect(SETTING_SENSITIVITY[SettingKey.AI_ENABLED]).toBeUndefined();
		});
	});

	describe('isFilePath', () => {
		it('should detect Unix absolute paths', () => {
			expect(isFilePath('/etc/cert.pem')).toBe(true);
			expect(isFilePath('/home/user/.certs/macaroon')).toBe(true);
		});

		it('should detect home directory paths', () => {
			expect(isFilePath('~/.lnd/tls.cert')).toBe(true);
			expect(isFilePath('~/certs/admin.macaroon')).toBe(true);
		});

		it('should detect relative paths', () => {
			expect(isFilePath('./certs/cert.pem')).toBe(true);
			expect(isFilePath('../certs/cert.pem')).toBe(true);
		});

		it('should detect Windows paths', () => {
			expect(isFilePath('C:\\Users\\cert.pem')).toBe(true);
			expect(isFilePath('d:\\certs\\macaroon')).toBe(true);
		});

		it('should reject non-path values', () => {
			expect(isFilePath('MIIBxTCCAWugAwIBAgIRAJ')).toBe(false);
			expect(isFilePath('sk-or-v1-abc123')).toBe(false);
			expect(isFilePath('-----BEGIN CERTIFICATE-----')).toBe(false);
			expect(isFilePath('')).toBe(false);
		});
	});

	describe('getSettingSensitivity', () => {
		it('should return ALWAYS for known sensitive keys', () => {
			expect(getSettingSensitivity(SettingKey.AI_OPENROUTER_KEY)).toBe(SettingSensitivity.ALWAYS);
		});

		it('should return NONE for unknown keys', () => {
			expect(getSettingSensitivity(SettingKey.BITCOIN_ORACLE)).toBe(SettingSensitivity.NONE);
			expect(getSettingSensitivity(SettingKey.AI_VENDOR)).toBe(SettingSensitivity.NONE);
		});
	});

	describe('isSettingSensitive', () => {
		it('should return true for ALWAYS sensitive keys regardless of value', () => {
			expect(isSettingSensitive(SettingKey.AI_OPENROUTER_KEY, 'sk-or-v1-abc123')).toBe(true);
			expect(isSettingSensitive(SettingKey.AI_OPENROUTER_KEY, '')).toBe(true);
			expect(isSettingSensitive(SettingKey.MESSAGES_TELEGRAM_BOT_TOKEN, '123:ABC')).toBe(true);
		});

		it('should return false for NONE sensitivity keys', () => {
			expect(isSettingSensitive(SettingKey.BITCOIN_ORACLE, 'true')).toBe(false);
			expect(isSettingSensitive(SettingKey.AI_VENDOR, 'ollama')).toBe(false);
		});
	});

	/* *******************************************************
		Masking
	******************************************************** */

	describe('maskSensitiveValue', () => {
		it('should return empty string for empty value', () => {
			expect(maskSensitiveValue('')).toBe('');
		});

		it('should mask short values completely', () => {
			expect(maskSensitiveValue('abc')).toBe('\u2022\u2022\u2022\u2022');
			expect(maskSensitiveValue('abcd')).toBe('\u2022\u2022\u2022\u2022');
		});

		it('should show last 4 characters for longer values', () => {
			expect(maskSensitiveValue('sk-or-v1-abc123')).toBe('\u2022\u2022\u2022\u2022c123');
			expect(maskSensitiveValue('12345')).toBe('\u2022\u2022\u2022\u20222345');
		});
	});

	/* *******************************************************
		Parsing
	******************************************************** */

	describe('parseSettingValue', () => {
		it('should parse boolean true', () => {
			expect(
				parseSettingValue({key: SettingKey.BITCOIN_ORACLE, value: 'true', value_type: SettingValue.BOOLEAN, description: null}),
			).toBe(true);
		});

		it('should parse boolean false', () => {
			expect(
				parseSettingValue({key: SettingKey.BITCOIN_ORACLE, value: 'false', value_type: SettingValue.BOOLEAN, description: null}),
			).toBe(false);
		});

		it('should treat non-true strings as false for booleans', () => {
			expect(
				parseSettingValue({key: SettingKey.BITCOIN_ORACLE, value: '', value_type: SettingValue.BOOLEAN, description: null}),
			).toBe(false);
			expect(
				parseSettingValue({key: SettingKey.BITCOIN_ORACLE, value: 'yes', value_type: SettingValue.BOOLEAN, description: null}),
			).toBe(false);
		});

		it('should parse number values', () => {
			expect(
				parseSettingValue({key: SettingKey.BITCOIN_ORACLE, value: '42', value_type: SettingValue.NUMBER, description: null}),
			).toBe(42);
			expect(
				parseSettingValue({key: SettingKey.BITCOIN_ORACLE, value: '3.14', value_type: SettingValue.NUMBER, description: null}),
			).toBe(3.14);
		});

		it('should return NaN for invalid number values', () => {
			expect(
				parseSettingValue({key: SettingKey.BITCOIN_ORACLE, value: 'abc', value_type: SettingValue.NUMBER, description: null}),
			).toBeNaN();
		});

		it('should parse JSON values', () => {
			expect(
				parseSettingValue({key: SettingKey.BITCOIN_ORACLE, value: '{"a":1}', value_type: SettingValue.JSON, description: null}),
			).toEqual({a: 1});
		});

		it('should return null for invalid JSON', () => {
			expect(
				parseSettingValue({key: SettingKey.BITCOIN_ORACLE, value: '{invalid', value_type: SettingValue.JSON, description: null}),
			).toBeNull();
		});

		it('should return string values as-is', () => {
			expect(
				parseSettingValue({key: SettingKey.AI_VENDOR, value: 'ollama', value_type: SettingValue.STRING, description: null}),
			).toBe('ollama');
		});

		it('should return empty string as-is for string type', () => {
			expect(parseSettingValue({key: SettingKey.AI_VENDOR, value: '', value_type: SettingValue.STRING, description: null})).toBe('');
		});
	});

	/* *******************************************************
		Encryption
	******************************************************** */

	describe('deriveEncryptionKey', () => {
		it('should derive a 32-byte key', () => {
			const key = deriveEncryptionKey('test-secret');
			expect(key).toBeInstanceOf(Buffer);
			expect(key.length).toBe(32);
		});

		it('should derive the same key for the same input', () => {
			const key1 = deriveEncryptionKey('test-secret');
			const key2 = deriveEncryptionKey('test-secret');
			expect(key1.equals(key2)).toBe(true);
		});

		it('should derive different keys for different inputs', () => {
			const key1 = deriveEncryptionKey('secret-a');
			const key2 = deriveEncryptionKey('secret-b');
			expect(key1.equals(key2)).toBe(false);
		});
	});

	describe('deriveEncryptionKeyFromHex', () => {
		const hex_key = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

		it('should derive a 32-byte key', () => {
			const key = deriveEncryptionKeyFromHex(hex_key);
			expect(key).toBeInstanceOf(Buffer);
			expect(key.length).toBe(32);
		});

		it('should derive the same key for the same input', () => {
			const key1 = deriveEncryptionKeyFromHex(hex_key);
			const key2 = deriveEncryptionKeyFromHex(hex_key);
			expect(key1.equals(key2)).toBe(true);
		});

		it('should derive different keys for different inputs', () => {
			const key1 = deriveEncryptionKeyFromHex(hex_key);
			const key2 = deriveEncryptionKeyFromHex('ff'.repeat(32));
			expect(key1.equals(key2)).toBe(false);
		});

		it('should produce a different key than deriveEncryptionKey with equivalent input', () => {
			const legacy_key = deriveEncryptionKey('test-secret');
			const hex_input = Buffer.from('test-secret').toString('hex').padEnd(64, '0');
			const new_key = deriveEncryptionKeyFromHex(hex_input);
			expect(legacy_key.equals(new_key)).toBe(false);
		});
	});

	describe('encryptValue / decryptValue', () => {
		const key = deriveEncryptionKey('test-secret');

		it('should round-trip encrypt and decrypt', () => {
			const plaintext = 'sk-or-v1-abc123def456';
			const encrypted = encryptValue(plaintext, key);
			const decrypted = decryptValue(encrypted, key);
			expect(decrypted).toBe(plaintext);
		});

		it('should produce different ciphertexts for same plaintext (random IV)', () => {
			const plaintext = 'same-value';
			const enc1 = encryptValue(plaintext, key);
			const enc2 = encryptValue(plaintext, key);
			expect(enc1).not.toBe(enc2);
		});

		it('should prefix encrypted values with enc:', () => {
			const encrypted = encryptValue('test', key);
			expect(encrypted.startsWith('enc:')).toBe(true);
		});

		it('should return plaintext as-is when not encrypted', () => {
			expect(decryptValue('plain-value', key)).toBe('plain-value');
			expect(decryptValue('', key)).toBe('');
			expect(decryptValue('false', key)).toBe('false');
		});

		it('should return malformed enc: values as-is', () => {
			expect(decryptValue('enc:invalid', key)).toBe('enc:invalid');
			expect(decryptValue('enc:a:b', key)).toBe('enc:a:b');
		});

		it('should handle unicode values', () => {
			const plaintext = 'key-with-emoji-\u{1F512}';
			const encrypted = encryptValue(plaintext, key);
			expect(decryptValue(encrypted, key)).toBe(plaintext);
		});
	});

	describe('isEncrypted', () => {
		it('should return true for encrypted values', () => {
			const key = deriveEncryptionKey('test');
			const encrypted = encryptValue('value', key);
			expect(isEncrypted(encrypted)).toBe(true);
		});

		it('should return false for plaintext values', () => {
			expect(isEncrypted('plain-value')).toBe(false);
			expect(isEncrypted('')).toBe(false);
			expect(isEncrypted('false')).toBe(false);
		});
	});
});
