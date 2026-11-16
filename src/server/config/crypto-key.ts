/* Core Dependencies */
import {readFileSync, writeFileSync, chmodSync} from 'fs';
import {createHash, randomBytes} from 'crypto';
import {join} from 'path';
/* Local Dependencies */
import {getDataDir} from './configuration.helpers.js';

/**
 * Get the file path for the persisted crypto key
 * @returns {string} Path to the crypto.key file
 */
export const getCryptoKeyPath = (): string => {
	const data_dir = getDataDir();
	return join(data_dir, 'crypto.key');
};

/**
 * Load an existing crypto key from disk, or generate and persist a new one.
 * If the CRYPTO_KEY env var is set, it takes priority over the file.
 * @returns {string} Hex-encoded 32-byte crypto key (64 hex chars)
 */
export const loadOrCreateCryptoKey = (): string => {
	const env_key = process.env.CRYPTO_KEY;
	if (env_key) return createHash('sha256').update(env_key).digest('hex');

	const key_path = getCryptoKeyPath();

	try {
		return readFileSync(key_path, 'utf8').trim();
	} catch (err: any) {
		if (err.code !== 'ENOENT') throw err;
	}

	const key_hex = randomBytes(32).toString('hex');
	try {
		writeFileSync(key_path, key_hex + '\n', {flag: 'wx', mode: 0o600});
	} catch (err: any) {
		if (err.code === 'EEXIST') {
			return readFileSync(key_path, 'utf8').trim();
		}
		throw err;
	}

	try {
		chmodSync(key_path, 0o600);
	} catch {
		/* chmod may fail on some platforms (Windows, certain Docker volumes) */
	}

	return key_hex;
};

/**
 * Generate an ephemeral JWT secret that lives only in memory for the current process.
 * Every server boot produces a new secret, invalidating all prior JWTs.
 * @returns {string} Hex-encoded 64-byte random secret (128 hex chars)
 */
export const generateEphemeralJwtSecret = (): string => {
	return randomBytes(64).toString('hex');
};
