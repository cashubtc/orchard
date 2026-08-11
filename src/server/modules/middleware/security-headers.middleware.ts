/* Core Dependencies */
import {randomBytes} from 'crypto';
import type {Request, Response, NextFunction} from 'express';
/* Local Dependencies */
import {CSP_NONCE_KEY} from './middleware.constants.js';

const STATIC_CSP = [
	"default-src 'self'",
	"img-src 'self' data: https: http:",
	"connect-src 'self'",
	"font-src 'self'",
	"object-src 'none'",
	"frame-ancestors 'none'",
	"base-uri 'self'",
	"form-action 'self'",
	"style-src-attr 'unsafe-inline'",
].join('; ');

/**
 * Security Headers
 * Generates a per-request CSP nonce (exposed as `res.locals.csp_nonce` for template injection).
 * In production CSP blocks violations; in dev it only reports them.
 */
export function securityHeaders(production: boolean) {
	const csp_header = production ? 'Content-Security-Policy' : 'Content-Security-Policy-Report-Only';
	const dev_csp = `${STATIC_CSP}; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'`;
	const build_csp = production
		? (nonce: string) => `${STATIC_CSP}; script-src 'nonce-${nonce}' 'strict-dynamic'; style-src 'self' 'nonce-${nonce}'`
		: () => dev_csp;

	return (_req: Request, res: Response, next: NextFunction): void => {
		const nonce = randomBytes(16).toString('base64');
		res.locals[CSP_NONCE_KEY] = nonce;
		res.setHeader('X-Content-Type-Options', 'nosniff');
		res.setHeader('X-Frame-Options', 'DENY');
		res.setHeader('X-XSS-Protection', '0');
		res.setHeader('X-DNS-Prefetch-Control', 'off');
		res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
		res.setHeader('Referrer-Policy', 'no-referrer');
		res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
		res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
		res.setHeader(csp_header, build_csp(nonce));
		next();
	};
}
