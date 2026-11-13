/* Core Dependencies */
import {resolve} from 'node:path';
import type {RequestHandler} from 'express';

/** Serves only the generated public configuration, without exposing writable state. */
export function runtimeConfig(): RequestHandler {
	const config_path = resolve(process.env.DATABASE_DIR || 'data', 'config.json');
	return (_req, res): void => {
		res.setHeader('Cache-Control', 'no-store');
		res.sendFile(config_path);
	};
}
