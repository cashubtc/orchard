/**
 * Feature spec: `orc-bitcoin-subsection-disabled` + `orc-lightning-subsection-disabled`
 * — the "backend absent" pages at `/bitcoin/disabled` and `/lightning/disabled`.
 *
 * These render only when Orchard boots without BITCOIN_TYPE / LIGHTNING_TYPE,
 * which on the shipped matrix is fake-cdk-postgres alone. The @no-bitcoin /
 * @no-lightning tags match that stack only, so on every other project these
 * tests match zero grep and are skipped.
 *
 * Behavior (redesigned upstream — env-sample explainers and the lnd/cln
 * selector were REPLACED by docs-link cards): each page renders one
 * `orc-public-docs-link-card` whose button opens the
 * `orc-public-exit-warning` dialog carrying the official docs URL
 * (docs.orchard.space). Navigation only happens on Proceed — the spec
 * asserts the dialog + link and CANCELS, never leaving the app.
 *
 * Coverage:
 *   - /bitcoin redirects to /bitcoin/disabled and renders the Bitcoin
 *     Configuration docs card
 *   - /lightning redirects to /lightning/disabled with the Lightning card
 *   - the docs button surfaces the exit-warning dialog with the exact
 *     configuration-docs URL (anchored per section); Cancel stays in-app
 *
 * NOT covered (see skip taxonomy in the .md):
 *   - mint disabled (`dead-branch` — fake runs cdk-mintd, mint stays enabled)
 *   - the Proceed click (`unit-better` — it window.opens an external site;
 *     the dialog's own Karma spec owns that wiring)
 */

import {test, expect, type Page} from '@playwright/test';

/** Drive the docs-link card's button and assert the exit-warning dialog
 *  surfaces the expected docs URL, then Cancel back into the app. */
async function assertDocsLinkDialog(page: Page, button_name: string, docs_url: string): Promise<void> {
	await page.getByRole('button', {name: button_name}).click();
	const dialog = page.locator('orc-public-exit-warning');
	await expect(dialog).toBeVisible();
	await expect(dialog).toContainText('You are about to leave the app');
	// The dialog renders the raw target URL — the operator sees exactly
	// where Proceed would take them.
	await expect(dialog).toContainText(docs_url);
	await dialog.getByRole('button', {name: 'Cancel'}).click();
	await expect(page.locator('orc-public-exit-warning')).toHaveCount(0);
}

test.describe('bitcoin disabled — /bitcoin/disabled', {tag: '@no-bitcoin'}, () => {
	test('/bitcoin redirects to the disabled page with the Bitcoin docs-link card', async ({page}) => {
		await page.goto('/bitcoin', {waitUntil: 'networkidle'});
		await expect(page).toHaveURL(/\/bitcoin\/disabled$/);
		const disabled = page.locator('orc-bitcoin-subsection-disabled');
		await expect(disabled).toBeVisible();
		await expect(disabled.locator('orc-public-docs-link-card')).toHaveCount(1);
		await expect(disabled).toContainText('Bitcoin Configuration');

		// The docs button opens the exit-warning dialog with the anchored
		// configuration-docs URL; Cancel keeps the operator in-app.
		await assertDocsLinkDialog(page, 'Bitcoin configuration docs', 'https://docs.orchard.space/install/configuration/#bitcoin');
		await expect(page).toHaveURL(/\/bitcoin\/disabled$/);
	});
});

test.describe('lightning disabled — /lightning/disabled', {tag: '@no-lightning'}, () => {
	test('/lightning redirects to the disabled page with the Lightning docs-link card', async ({page}) => {
		await page.goto('/lightning', {waitUntil: 'networkidle'});
		await expect(page).toHaveURL(/\/lightning\/disabled$/);
		const disabled = page.locator('orc-lightning-subsection-disabled');
		await expect(disabled).toBeVisible();
		await expect(disabled.locator('orc-public-docs-link-card')).toHaveCount(1);
		await expect(disabled).toContainText('Lightning Configuration');

		await assertDocsLinkDialog(page, 'Lightning configuration docs', 'https://docs.orchard.space/install/configuration/#lightning');
		await expect(page).toHaveURL(/\/lightning\/disabled$/);
	});
});
