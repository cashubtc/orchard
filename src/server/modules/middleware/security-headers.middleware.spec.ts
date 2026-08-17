import type {Request, Response, NextFunction} from 'express';

import {securityHeaders} from './security-headers.middleware.js';

describe('securityHeaders', () => {
	let req: Partial<Request>;
	let res: Partial<Response>;
	let next: NextFunction;

	const invoke = (production: boolean) => {
		securityHeaders(production)(req as Request, res as Response, next);
	};

	const headerValue = (name: string): string | undefined => {
		const setHeader = res.setHeader as jest.Mock;
		const call = setHeader.mock.calls.find(([header]) => header === name);
		return call?.[1] as string | undefined;
	};

	beforeEach(() => {
		req = {};
		res = {
			locals: {},
			setHeader: jest.fn().mockReturnThis(),
		};
		next = jest.fn();
	});

	it('should set X-Content-Type-Options', () => {
		invoke(true);
		expect(headerValue('X-Content-Type-Options')).toBe('nosniff');
	});

	it('should set X-Frame-Options to DENY', () => {
		invoke(true);
		expect(headerValue('X-Frame-Options')).toBe('DENY');
	});

	it('should disable X-XSS-Protection', () => {
		invoke(true);
		expect(headerValue('X-XSS-Protection')).toBe('0');
	});

	it('should set X-DNS-Prefetch-Control to off', () => {
		invoke(true);
		expect(headerValue('X-DNS-Prefetch-Control')).toBe('off');
	});

	it('should set X-Permitted-Cross-Domain-Policies to none', () => {
		invoke(true);
		expect(headerValue('X-Permitted-Cross-Domain-Policies')).toBe('none');
	});

	it('should set Referrer-Policy to no-referrer', () => {
		invoke(true);
		expect(headerValue('Referrer-Policy')).toBe('no-referrer');
	});

	it('should set Cross-Origin-Opener-Policy to same-origin', () => {
		invoke(true);
		expect(headerValue('Cross-Origin-Opener-Policy')).toBe('same-origin');
	});

	it('should set Cross-Origin-Resource-Policy to same-origin', () => {
		invoke(true);
		expect(headerValue('Cross-Origin-Resource-Policy')).toBe('same-origin');
	});

	it('should generate a per-request CSP nonce on res.locals', () => {
		invoke(true);
		const nonce = (res.locals as Record<string, string>)['csp_nonce'];
		expect(typeof nonce).toBe('string');
		expect(nonce.length).toBeGreaterThan(0);
	});

	it('should generate a different nonce on each invocation', () => {
		invoke(true);
		const first = (res.locals as Record<string, string>)['csp_nonce'];
		res.locals = {};
		invoke(true);
		const second = (res.locals as Record<string, string>)['csp_nonce'];
		expect(first).not.toBe(second);
	});

	it('should emit nonce-based CSP in production', () => {
		invoke(true);
		const nonce = (res.locals as Record<string, string>)['csp_nonce'];
		const csp = headerValue('Content-Security-Policy');
		expect(csp).toContain(`script-src 'nonce-${nonce}' 'strict-dynamic'`);
		expect(csp).toContain(`style-src 'self' 'nonce-${nonce}'`);
		// script-src and style-src must NOT fall back to 'unsafe-inline' in prod
		expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
		expect(csp).not.toMatch(/(?<!-attr) 'self' 'unsafe-inline'/);
		// style-src-attr is the safety valve for inline style="..." attrs
		expect(csp).toContain("style-src-attr 'unsafe-inline'");
	});

	it('should emit unsafe-inline CSP (report-only) in development', () => {
		invoke(false);
		const csp = headerValue('Content-Security-Policy-Report-Only');
		expect(csp).toContain("script-src 'self' 'unsafe-inline'");
		expect(csp).toContain("style-src 'self' 'unsafe-inline'");
		expect(csp).not.toContain("'nonce-");
		expect(csp).not.toContain("'strict-dynamic'");
	});

	it('should include the full set of static directives', () => {
		invoke(true);
		const csp = headerValue('Content-Security-Policy');
		expect(csp).toContain("default-src 'self'");
		expect(csp).toContain("img-src 'self' data: https: http:");
		expect(csp).toContain("connect-src 'self'");
		expect(csp).toContain("font-src 'self'");
		expect(csp).toContain("object-src 'none'");
		expect(csp).toContain("frame-ancestors 'none'");
		expect(csp).toContain("base-uri 'self'");
		expect(csp).toContain("form-action 'self'");
	});

	it('should call next()', () => {
		invoke(true);
		expect(next).toHaveBeenCalled();
	});
});
