import assert from 'node:assert/strict';
import {expect} from '@playwright/test';

/** Exercise read-only federation and existing mint pages using an authenticated dev-stack session. */
export async function checkMemberDashboard(page, index) {
	const base = `http://127.0.0.1:${3361 + index}`;
	const errors = [];
	const operations = [];
	const member_times = [];
	const pending = [];
	const on_request = (request) => {
		if (request.method() !== 'POST' || !request.url().endsWith('/api')) return;
		const query = request.postDataJSON().query ?? '';
		operations.push(query);
		if (query.includes('federation_member_statuses')) member_times.push(Date.now());
	};
	const on_response = (response) => {
		if (!response.url().endsWith('/api') || response.request().method() !== 'POST') return;
		pending.push(
			response
				.json()
				.then((result) => {
					for (const error of result.errors ?? [])
						errors.push({code: error.extensions?.code, message: error.message, details: error.extensions?.details});
				})
				.catch((error) => {
					errors.push({message: error.message});
				}),
		);
	};
	page.on('request', on_request);
	page.on('response', on_response);
	try {
		await page.getByRole('button', {name: 'Open the federation', exact: true}).click();
		await expect(page.getByRole('heading', {name: 'Federation overview', exact: true})).toBeVisible();
		await expect(page.getByRole('heading', {name: 'Payments', exact: true})).toBeVisible();
		await expect(page.locator('orc-federation-overview')).toContainText('BOLT 11', {timeout: 30000});
		await expect.poll(() => member_times.length, {timeout: 20000}).toBeGreaterThanOrEqual(2);
		for (let i = 1; i < member_times.length; i++)
			assert(member_times[i] - member_times[i - 1] >= 5000, 'Peer status polled too quickly');
		assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Federation overview overflows');
		if (index < 2) {
			await page.getByRole('heading', {name: 'Federation overview', exact: true}).scrollIntoViewIfNeeded();
			await page.screenshot({path: `/tmp/orchard-m4-${index === 1 ? 'mobile' : 'desktop'}.png`, fullPage: true});
		}
		await page.getByRole('link', {name: 'Consensus', exact: true}).click();
		await expect(page.getByRole('heading', {name: 'Federation consensus', exact: true})).toBeVisible();
		await expect(page.getByRole('heading', {name: 'Invalid-operation alerts', exact: true})).toBeVisible();
		await page.getByRole('link', {name: 'Custody', exact: true}).click();
		await expect(page.getByRole('heading', {name: 'No funds held', exact: true})).toBeVisible();
		await expect(page.getByTestId('federation-custody-off')).toHaveCount(0);
		await page.getByRole('link', {name: 'Overview', exact: true}).click();
		await expect(page.getByRole('heading', {name: 'Federation overview', exact: true})).toBeVisible();
		for (let i = 1; i < member_times.length; i++)
			assert(member_times[i] - member_times[i - 1] >= 5000, 'Peer status polled too quickly after changing views');
		await page.getByRole('link', {name: 'Backup checklist', exact: true}).click();
		await expect(page.getByRole('heading', {name: 'Back up before using real funds', exact: true})).toBeVisible();
		const polls_before_leaving = member_times.length;
		for (const path of ['/mint', '/mint/info', '/mint/keysets', '/mint/database']) {
			await page.goto(`${base}${path}`);
			await page.waitForLoadState('networkidle');
			assert.equal(new URL(page.url()).pathname, path, `Member ${index + 1}: ${path} redirected`);
			await expect(page.locator('orc-error-resolve')).toHaveCount(0);
			if (path === '/mint/keysets') {
				await expect(page.getByTestId('rotate-keyset')).toHaveCount(0);
				await expect(page.getByRole('button', {name: /Rotate keyset/i})).toHaveCount(0);
			}
			if (path === '/mint/database') {
				await page.getByTestId('mint-database-more').click();
				await expect(page.getByRole('menuitem', {name: /Refresh Data/i})).toBeVisible();
				await expect(page.getByRole('menuitem', {name: /Restore Backup/i})).toHaveCount(0);
				await page.keyboard.press('Escape');
				for (const label of ['Mints', 'Melts']) {
					await page.getByRole('combobox', {name: 'Data', exact: true}).click();
					await page.getByRole('option', {name: new RegExp(`^${label}\\b`)}).click();
					await page.waitForLoadState('networkidle');
				}
			}
		}
		assert.equal(member_times.length, polls_before_leaving, 'Peer polling continued after leaving federation');
		assert(
			operations.some((query) => query.includes('mint_analytics')),
			'Existing mint analytics were not exercised',
		);
		await page.goto(`${base}/mint/federation`);
		await expect(page.getByRole('heading', {name: 'Federation overview', exact: true})).toBeVisible();
	} finally {
		page.off('request', on_request);
		page.off('response', on_response);
		await Promise.all(pending);
	}
	assert.deepEqual(errors, [], `Member ${index + 1} returned GraphQL errors`);
	console.log(
		`PASS: member ${index + 1} Overview, Consensus, Custody, backup checklist, mint dashboard/info/keysets/database and analytics`,
	);
}
