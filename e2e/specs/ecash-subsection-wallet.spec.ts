/**
 * Feature spec: `orc-ecash-subsection-wallet` — the routed body of
 * `/ecash`. A placeholder stub (payments icon + "Ecash Dashboard Coming
 * Soon!") under the section's secondary nav: no data fetch, and —
 * deliberately noted — no `enabledGuard`, so the route mounts on every
 * stack including the backend-less fake-cdk-postgres.
 *
 * Coverage:
 *   - stub body renders (container, icon, text) and the route title lands
 *   - tagged @all: the value of running a static page on all five stacks
 *     is proving the section mounts with and without bitcoin/LN/mint
 *     backends wired
 *
 * Nothing is skipped — the whole surface is one static state. When the
 * real ecash wallet ships this spec fails loudly and gets rewritten.
 */

import {test, expect} from '@playwright/test';

test.describe('ecash subsection wallet — /ecash', {tag: '@all'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/ecash');
	});

	test('renders the placeholder stub body', async ({page}) => {
		const stub = page.locator('orc-ecash-subsection-wallet .ecash-wallet-container');
		await expect(stub).toBeVisible();
		await expect(stub.locator('mat-icon')).toHaveText('payments');
		await expect(stub.getByText('Ecash Dashboard Coming Soon!', {exact: true})).toBeVisible();
	});

	test('sets the route title', async ({page}) => {
		await expect(page).toHaveTitle('Orchard | Ecash');
	});
});
