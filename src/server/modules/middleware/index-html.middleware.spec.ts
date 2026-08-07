import {Request, Response, NextFunction} from 'express';
import type {readFileSync as ReadFileSync} from 'fs';

// Core modules bypass the ESM mock registry unless replaced at the module level.
jest.unstable_mockModule('fs', () => {
	const readFileSync = jest.fn();
	return {readFileSync, default: {readFileSync}};
});

const {readFileSync: mockedReadFileSync} = (await import('fs')) as unknown as {readFileSync: jest.MockedFunction<typeof ReadFileSync>};
const {indexHtml} = await import('./index-html.middleware.js');

describe('indexHtml', () => {
	let req: Partial<Request>;
	let res: Partial<Response>;
	let next: NextFunction;

	beforeEach(() => {
		req = {method: 'GET', headers: {accept: 'text/html,application/xhtml+xml'}};
		res = {
			locals: {csp_nonce: 'test-nonce-abc'},
			setHeader: jest.fn().mockReturnThis(),
			send: jest.fn().mockReturnThis(),
		};
		next = jest.fn();
		mockedReadFileSync.mockReset();
	});

	it('should replace every CSP_NONCE placeholder with the per-request nonce', () => {
		mockedReadFileSync.mockReturnValue(
			'<script nonce="{{CSP_NONCE}}"></script><style nonce="{{CSP_NONCE}}"></style><orc-root ngCspNonce="{{CSP_NONCE}}"></orc-root>',
		);
		const middleware = indexHtml();
		middleware(req as Request, res as Response, next);

		const sent = (res.send as jest.Mock).mock.calls[0][0] as string;
		expect(sent).not.toContain('{{CSP_NONCE}}');
		expect((sent.match(/test-nonce-abc/g) || []).length).toBe(3);
	});

	it('should set Content-Type and Cache-Control', () => {
		mockedReadFileSync.mockReturnValue('<html></html>');
		indexHtml()(req as Request, res as Response, next);
		expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'text/html; charset=utf-8');
		expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
	});

	it('should skip non-GET/HEAD methods', () => {
		mockedReadFileSync.mockReturnValue('<html></html>');
		req.method = 'POST';
		indexHtml()(req as Request, res as Response, next);
		expect(next).toHaveBeenCalled();
		expect(res.send).not.toHaveBeenCalled();
	});

	it('should skip requests that do not accept text/html', () => {
		mockedReadFileSync.mockReturnValue('<html></html>');
		req.headers = {accept: 'application/json'};
		indexHtml()(req as Request, res as Response, next);
		expect(next).toHaveBeenCalled();
		expect(res.send).not.toHaveBeenCalled();
	});

	it('should return a no-op middleware if the client bundle is missing', () => {
		mockedReadFileSync.mockImplementation(() => {
			throw new Error('ENOENT');
		});
		const middleware = indexHtml();
		middleware(req as Request, res as Response, next);
		expect(next).toHaveBeenCalled();
		expect(res.send).not.toHaveBeenCalled();
	});

	it('should substitute an empty string if csp_nonce is missing on res.locals', () => {
		mockedReadFileSync.mockReturnValue('<orc-root ngCspNonce="{{CSP_NONCE}}"></orc-root>');
		res.locals = {};
		indexHtml()(req as Request, res as Response, next);
		const sent = (res.send as jest.Mock).mock.calls[0][0] as string;
		expect(sent).toBe('<orc-root ngCspNonce=""></orc-root>');
	});
});
