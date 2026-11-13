import {mkdtempSync, mkdirSync, writeFileSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import express from 'express';
import request from 'supertest';
import {runtimeConfig} from './runtime-config.middleware.js';
import {indexHtml} from './index-html.middleware.js';
import {securityHeaders} from './security-headers.middleware.js';

describe('production runtime configuration', () => {
	let directory: string;
	let app: express.Express;

	beforeEach(() => {
		directory = mkdtempSync(join(tmpdir(), 'orchard-config-'));
		jest.replaceProperty(process, 'env', {...process.env, DATABASE_DIR: directory, ASSETS_DIR: directory});
		mkdirSync(join(directory, 'dist/client/browser'), {recursive: true});
		writeFileSync(join(directory, 'dist/client/browser/index.html'), '<html nonce="{{CSP_NONCE}}"></html>');
		writeFileSync(join(directory, 'config.json'), '{"mode":{"production":true}}');
		writeFileSync(join(directory, 'secret.key'), 'private-state');
		app = express();
		app.use(securityHeaders(true));
		app.get('/config.json', runtimeConfig());
		app.use(indexHtml());
	});

	afterEach(() => {
		jest.restoreAllMocks();
		rmSync(directory, {recursive: true, force: true});
	});

	it('serves JSON before HTML fallback with no-store and CSP, including HEAD', async () => {
		const response = await request(app).get('/config.json').set('Accept', 'text/html').expect(200);
		expect(response.body).toEqual({mode: {production: true}});
		expect(response.headers['cache-control']).toBe('no-store');
		expect(response.headers['content-security-policy']).toContain("default-src 'self'");
		await request(app).head('/config.json').expect(200).expect('Cache-Control', 'no-store');
	});

	it('does not expose other state files', async () => {
		await request(app).get('/secret.key').set('Accept', 'application/json').expect(404);
		await request(app).get('/data/secret.key').set('Accept', 'application/json').expect(404);
	});

	it('does not fall back to HTML when the generated configuration is missing', async () => {
		rmSync(join(directory, 'config.json'));
		await request(app).get('/config.json').set('Accept', 'text/html').expect(404);
	});

	it('preserves per-request HTML nonces matching the CSP', async () => {
		const first = await request(app).get('/').set('Accept', 'text/html').expect(200);
		const second = await request(app).get('/').set('Accept', 'text/html').expect(200);
		const nonce = first.text.match(/nonce="([^"]+)"/)?.[1];
		expect(nonce).toBeTruthy();
		expect(first.headers['content-security-policy']).toContain(`'nonce-${nonce}'`);
		expect(first.text).not.toEqual(second.text);
	});
});
