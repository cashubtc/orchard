/**
 * Direct GraphQL calls against `/api` under the page's own session. Shared by
 * the readiness probes and the settings-setup GraphQL flip — anything that
 * needs to hit a resolver without driving the UI.
 */

import type {Page} from '@playwright/test';

/** Orchard puts the JWT in localStorage and the Apollo interceptor injects
 *  it as `Authorization: Bearer <token>` on every request. `page.request`
 *  inherits cookies but not localStorage, so we read the token via the page
 *  context and forward it explicitly — without it, resolvers reject the call
 *  with `AuthenticationError`. Call only after `page.goto(...)` — localStorage
 *  access on `about:blank` raises `SecurityError`. */
export async function gql(page: Page, query: string, variables?: Record<string, unknown>): Promise<Record<string, unknown>> {
	// LocalStorageService JSON-stringifies on write, so the raw localStorage
	// value has surrounding quotes — parse them off before forwarding.
	const raw = await page.evaluate(() => localStorage.getItem('v0.auth.token'));
	const token = raw ? (JSON.parse(raw) as string) : null;
	const headers: Record<string, string> = {};
	if (token) headers['Authorization'] = `Bearer ${token}`;
	const response = await page.request.post('/api', {headers, data: {query, variables}});
	if (!response.ok()) throw new Error(`GraphQL ${response.status()} on direct query`);
	const body = await response.json();
	if (body.errors?.length) throw new Error(`GraphQL error: ${body.errors[0].message}`);
	return body.data;
}
