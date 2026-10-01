/**
 * Feature spec: `orc-ecash-subsection-wallet` — the routed body of
 * `/ecash`, under the section's secondary nav. Shows the wallet balance:
 * one row per unit, or a unitless 0 when the wallet is empty. No
 * `enabledGuard`, so the route mounts on every stack including the
 * backend-less fake-cdk-postgres.
 *
 * Coverage:
 *   - the balance card renders (rows or the empty 0) and the route title lands
 *   - tagged @all: proves the section mounts with and without
 *     bitcoin/LN/mint backends wired
 */

import {test, expect} from '@playwright/test';

test.describe('ecash subsection wallet — /ecash', {tag: '@all'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/ecash');
	});

	test('renders the wallet balance', async ({page}) => {
		const balance = page.locator('orc-ecash-subsection-wallet orc-ecash-general-balance');
		await expect(balance.getByText('Balance', {exact: true})).toBeVisible();
		await expect(balance.locator('orc-graphic-asset, .ecash-balance-empty').first()).toBeVisible();
	});

	test('sets the route title', async ({page}) => {
		await expect(page).toHaveTitle('Orchard | Ecash');
	});
});
