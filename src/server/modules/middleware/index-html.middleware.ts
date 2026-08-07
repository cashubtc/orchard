/* Core Dependencies */
import {readFileSync} from 'fs';
import {join} from 'path';
import {Request, Response, NextFunction} from 'express';
/* Local Dependencies */
import {CSP_NONCE_KEY, CSP_NONCE_PLACEHOLDER} from './middleware.constants.js';

const CLIENT_INDEX_PATH = join(process.cwd(), 'dist', 'client', 'browser', 'index.html');

/**
 * Caches the client index.html template once at startup and serves a per-request copy
 * with the CSP nonce placeholder replaced. Only invoked in production — dev uses the
 * Angular dev server to serve index.html directly.
 *
 * Returns a no-op middleware if the client bundle isn't present (e.g. server-only runs).
 */
export function indexHtml() {
	let template: string;
	try {
		template = readFileSync(CLIENT_INDEX_PATH, 'utf8');
	} catch {
		// Client bundle not built — fall through to serve-static / 404
		return (_req: Request, _res: Response, next: NextFunction) => next();
	}

	return (req: Request, res: Response, next: NextFunction): void => {
		if (req.method !== 'GET' && req.method !== 'HEAD') return next();
		const accept = req.headers.accept || '';
		if (!accept.includes('text/html')) return next();
		const nonce = (res.locals[CSP_NONCE_KEY] as string | undefined) ?? '';
		const html = template.replace(CSP_NONCE_PLACEHOLDER, nonce);
		res.setHeader('Content-Type', 'text/html; charset=utf-8');
		res.setHeader('Cache-Control', 'no-store');
		res.send(html);
	};
}
