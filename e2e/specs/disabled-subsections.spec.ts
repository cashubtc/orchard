/**
 * Feature spec: `orc-bitcoin-subsection-disabled` + `orc-lightning-subsection-disabled`
 * — the "backend absent" pages at `/bitcoin/disabled` and `/lightning/disabled`.
 *
 * These render only when Orchard boots without BITCOIN_TYPE / LIGHTNING_TYPE,
 * which on the shipped matrix is fake-cdk-postgres alone. The @no-bitcoin /
 * @no-lightning tags match that stack only, so on every other project these
 * tests match zero grep and are skipped.
 *
 * Coverage:
 *   - /bitcoin redirects to /bitcoin/disabled and renders the env explainer
 *   - /lightning redirects to /lightning/disabled with the lnd/cln selector
 *     + two env explainers (lightning + taproot assets)
 *   - switching the selector to cln swaps the lightning env sample
 *
 * NOT covered (see skip taxonomy in the .md):
 *   - mint disabled (`dead-branch` — fake runs cdk-mintd, mint stays enabled)
 *   - env copy-to-clipboard (`unit-better` — settings-env component's own concern)
 */

import {test, expect} from '@playwright/test';

test.describe('bitcoin disabled — /bitcoin/disabled', {tag: '@no-bitcoin'}, () => {
	test('/bitcoin redirects to the disabled page with an env explainer', async ({page}) => {
		await page.goto('/bitcoin', {waitUntil: 'networkidle'});
		await expect(page).toHaveURL(/\/bitcoin\/disabled$/);
		const disabled = page.locator('orc-bitcoin-subsection-disabled');
		await expect(disabled).toBeVisible();
		await expect(disabled.locator('orc-settings-general-env')).toHaveCount(1);
	});
});

test.describe('lightning disabled — /lightning/disabled', {tag: '@no-lightning'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/lightning', {waitUntil: 'networkidle'});
		await expect(page).toHaveURL(/\/lightning\/disabled$/);
	});

	test('renders the lnd/cln selector and two env explainers', async ({page}) => {
		const disabled = page.locator('orc-lightning-subsection-disabled');
		await expect(disabled).toBeVisible();
		await expect(disabled.locator('mat-select')).toHaveCount(1);
		// One lightning sample (default lnd) + one taproot-assets sample.
		await expect(disabled.locator('orc-settings-general-env')).toHaveCount(2);
	});

	test('defaults to the lnd sample and swaps to cln on select', async ({page}) => {
		const disabled = page.locator('orc-lightning-subsection-disabled');
		// Default lnd: the lightning sample advertises LIGHTNING_MACAROON.
		await expect(disabled.getByText('LIGHTNING_MACAROON')).toBeVisible();
		// Open the Material select and pick cln (options render in the CDK
		// overlay as role=option).
		await disabled.locator('mat-select').click();
		await page.getByRole('option', {name: 'cln'}).click();
		// cln sample swaps in LIGHTNING_KEY / LIGHTNING_CA and drops the macaroon.
		await expect(disabled.getByText('LIGHTNING_KEY')).toBeVisible();
		await expect(disabled.getByText('LIGHTNING_MACAROON')).toHaveCount(0);
	});
});
