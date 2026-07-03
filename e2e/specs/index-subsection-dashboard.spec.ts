/**
 * Feature spec: `orc-index-subsection-dashboard` — the home route `/`.
 *
 * Page-level contract only: which tile (enabled vs disabled) each of the
 * four sections renders per stack, the section headers, the always-disabled
 * Ecash row, and the disabled tiles' navigate buttons. The enabled tiles'
 * card internals are covered by the per-card specs and are NOT re-asserted.
 *
 * The disabled tiles for Bitcoin and Lightning only exist on the backend-less
 * fake-cdk-postgres stack, so the whole point of tagging @all is to see both
 * sides of each @if across the matrix. Assertions pivot on `config.bitcoin`
 * / `config.ln` so each stack checks the branch it actually renders.
 *
 * NOT covered:
 *   - mint-disabled tile (`dead-branch` — no shipped stack runs mint-less)
 *   - section error surfaces (`disruptive` — needs a backend fault)
 *   - enabled-tile card internals (owned by the per-card specs)
 */

import {test, expect, type Page} from '@playwright/test';

import {getConfig} from '@e2e/helpers/config';

async function settle(page: Page): Promise<void> {
	await expect(page.locator('orc-index-subsection-dashboard-bitcoin-header')).toBeVisible();
}

test.describe('index dashboard — /', {tag: '@all'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/');
		await settle(page);
	});

	test('renders all four section headers', async ({page}) => {
		await expect(page.locator('orc-index-subsection-dashboard-bitcoin-header').getByText('Bitcoin', {exact: true})).toBeVisible();
		await expect(page.locator('orc-index-subsection-dashboard-lightning-header').getByText('Lightning', {exact: true})).toBeVisible();
		await expect(page.locator('orc-index-subsection-dashboard-mint-header').getByText('Mint', {exact: true})).toBeVisible();
		await expect(page.locator('orc-index-subsection-dashboard-ecash-header').getByText('Ecash', {exact: true})).toBeVisible();
	});

	test('bitcoin row renders the tile matching the stack config', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const enabled = page.locator('orc-index-subsection-dashboard-bitcoin-enabled');
		const disabled = page.locator('orc-index-subsection-dashboard-bitcoin-disabled');
		if (config.bitcoin) {
			await expect(enabled).toBeVisible();
			await expect(disabled).toHaveCount(0);
		} else {
			await expect(disabled).toBeVisible();
			await expect(enabled).toHaveCount(0);
			// The disabled tile's only behaviour: navigate to /bitcoin.
			await disabled.getByRole('button', {name: 'Bitcoin Configuration'}).click();
			await expect(page).toHaveURL(/\/bitcoin(\/disabled)?$/);
		}
	});

	test('lightning row renders the tile matching the stack config', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const enabled = page.locator('orc-index-subsection-dashboard-lightning-enabled');
		const disabled = page.locator('orc-index-subsection-dashboard-lightning-disabled');
		if (config.ln !== false) {
			await expect(enabled).toBeVisible();
			await expect(disabled).toHaveCount(0);
		} else {
			await expect(disabled).toBeVisible();
			await expect(enabled).toHaveCount(0);
			await disabled.getByRole('button', {name: 'Lightning Configuration'}).click();
			await expect(page).toHaveURL(/\/lightning(\/disabled)?$/);
		}
	});

	test('mint row renders the enabled tile on every shipped stack', async ({page}) => {
		// Every stack in the matrix wires a mint backend, so the enabled tile
		// always mounts. The disabled branch is a documented dead-branch.
		await expect(page.locator('orc-index-subsection-dashboard-mint-enabled')).toBeVisible();
		await expect(page.locator('orc-index-subsection-dashboard-mint-disabled')).toHaveCount(0);
	});

	test('ecash row is always disabled with the coming-soon copy', async ({page}) => {
		// `enabled_ecash` is hard-coded false — this holds on every stack and
		// is the tripwire for when the ecash wallet actually ships.
		const disabled = page.locator('orc-index-subsection-dashboard-ecash-disabled');
		await expect(disabled).toBeVisible();
		await expect(disabled.getByText('Ecash Wallet Coming Soon!')).toBeVisible();
		await expect(page.locator('orc-index-subsection-dashboard-ecash-enabled')).toHaveCount(0);
	});
});
