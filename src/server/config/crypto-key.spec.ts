/* Core Dependencies */
import {expect} from '@jest/globals';
import {existsSync, readFileSync, writeFileSync, unlinkSync, mkdtempSync, rmSync} from 'fs';
import {join} from 'path';
import {tmpdir} from 'os';
/* Local Dependencies */
import {getCryptoKeyPath, loadOrCreateCryptoKey, generateEphemeralJwtSecret} from './crypto-key.js';

describe('Crypto Key', () => {
	const original_env = {...process.env};
	let test_dir: string;
	let test_key_path: string;

	beforeEach(() => {
		process.env = {...original_env};
		delete process.env.CRYPTO_KEY;
		delete process.env.DATABASE_DIR;
		test_dir = mkdtempSync(join(tmpdir(), 'orchard-crypto-test-'));
		test_key_path = join(test_dir, 'crypto.key');
	});

	afterEach(() => {
		process.env = original_env;
		rmSync(test_dir, {recursive: true, force: true});
	});

	/* *******************************************************
		getCryptoKeyPath
	******************************************************** */

	describe('getCryptoKeyPath', () => {
		it('should use default data directory', () => {
			expect(getCryptoKeyPath()).toBe(join('data', 'crypto.key'));
		});

		it('should use DATABASE_DIR env var when set', () => {
			process.env.DATABASE_DIR = '/custom/path';
			expect(getCryptoKeyPath()).toBe(join('/custom/path', 'crypto.key'));
		});
	});

	/* *******************************************************
		loadOrCreateCryptoKey
	******************************************************** */

	describe('loadOrCreateCryptoKey', () => {
		it('should hash CRYPTO_KEY env var to 64 hex chars', () => {
			process.env.CRYPTO_KEY = 'my-strong-passphrase';
			const key = loadOrCreateCryptoKey();
			expect(key).toHaveLength(64);
			expect(/^[0-9a-f]{64}$/.test(key)).toBe(true);
		});

		it('should produce the same key for the same CRYPTO_KEY input', () => {
			process.env.CRYPTO_KEY = 'deterministic-input';
			const key1 = loadOrCreateCryptoKey();
			const key2 = loadOrCreateCryptoKey();
			expect(key1).toBe(key2);
		});

		it('should generate and persist a key file when none exists', () => {
			process.env.DATABASE_DIR = test_dir;
			const key = loadOrCreateCryptoKey();
			expect(key).toHaveLength(64);
			expect(/^[0-9a-f]{64}$/.test(key)).toBe(true);
			expect(existsSync(test_key_path)).toBe(true);
			expect(readFileSync(test_key_path, 'utf8').trim()).toBe(key);
		});

		it('should read existing key file', () => {
			process.env.DATABASE_DIR = test_dir;
			const existing_key = 'b'.repeat(64);
			writeFileSync(test_key_path, existing_key + '\n');
			const key = loadOrCreateCryptoKey();
			expect(key).toBe(existing_key);
		});

		it('should generate different keys on separate calls without file', () => {
			process.env.DATABASE_DIR = test_dir;
			const key1 = loadOrCreateCryptoKey();
			unlinkSync(test_key_path);
			const key2 = loadOrCreateCryptoKey();
			expect(key1).not.toBe(key2);
		});
	});

	/* *******************************************************
		generateEphemeralJwtSecret
	******************************************************** */

	describe('generateEphemeralJwtSecret', () => {
		it('should return a 128-character hex string', () => {
			const secret = generateEphemeralJwtSecret();
			expect(secret).toHaveLength(128);
			expect(/^[0-9a-f]{128}$/.test(secret)).toBe(true);
		});

		it('should produce different secrets on each call', () => {
			const secret1 = generateEphemeralJwtSecret();
			const secret2 = generateEphemeralJwtSecret();
			expect(secret1).not.toBe(secret2);
		});
	});
});
