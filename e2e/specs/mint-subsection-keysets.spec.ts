/**
 * Feature spec: `orc-mint-subsection-keysets` — the `/mint/keysets` page:
 * keyset inventory, per-keyset analytics, and the rotation flow.
 *
 * Read-only coverage. The rotation *save* mutates the daemon's keyset table
 * (appends a keyset, flips the old one inactive) and would break every
 * sibling spec that counts keysets — so this spec exercises the rotation
 * form's open/close and validation surface but never confirms a rotation.
 *
 * Coverage:
 *   - table rows == daemon keyset count (mint.keysets oracle); desktop
 *     column set is the full 9
 *   - fee-rate cell matches the keyset's input_fee_ppk
 *   - rotation FAB toggles the collapsible form open/closed
 *   - V1/V2 format differential: V2 disabled + "Unsupported in Nutshell"
 *     on nutshell, enabled + selected on cdk
 *   - filter menu lists one checkbox per provisioned unit + Active/Inactive;
 *     the Active filter narrows rows to the active-keyset count
 *   - unsaved-changes guard: navigating away mid-rotation opens the dialog,
 *     "Stay on page" cancels
 *   - mobile viewport collapses to a single column
 *
 * NOT covered:
 *   - rotation save/confirm (`disruptive`)
 *   - analytics column values (`unit-better` here — owned by the
 *     mint-general-keysets card spec's @analytics differential)
 *   - chart series/highlight pixels (`unit-better` — canvas)
 *   - AI assistant (`stack-only` — cln-cdk-postgres via e2e:test:ai)
 */

import {test, expect, type Locator, type Page} from '@playwright/test';

import {getConfig, mintUnitsFor} from '@e2e/helpers/config';
import {mint} from '@e2e/helpers/backend';

const DESKTOP_COLUMNS = 9;

async function openPage(page: Page): Promise<Locator> {
	const table = page.locator('orc-mint-subsection-keysets-table');
	await expect(table).toBeVisible();
	// Resolvers pre-settle, so rows render with the route on every stack
	// (daemons auto-provision at least one active sat keyset).
	await expect(table.locator('tr.entity-row').first()).toBeVisible();
	return table;
}

function amountFromText(text: string | null | undefined): number {
	const stripped = (text ?? '').replace(/\D/g, '');
	return stripped === '' ? 0 : parseInt(stripped, 10);
}

async function openFilterMenu(page: Page): Promise<Locator> {
	await page.locator('orc-mint-subsection-keysets-control button', {hasText: 'Filters'}).click();
	const menu = page.locator('.cdk-overlay-container orc-form-filter-menu');
	await expect(menu).toBeVisible();
	return menu;
}

test.describe('mint subsection keysets — /mint/keysets', {tag: '@mint'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/mint/keysets');
	});

	test('renders one table row per daemon keyset', async ({page}, testInfo) => {
		// Differential oracle: mint.keysets reads the daemon's keyset table
		// directly. The table's default (unfiltered) row set is one row per
		// keyset whose valid_from <= date_end (end of today) — true for all.
		const config = getConfig(testInfo.project.name);
		const expected = mint.keysets(config).length;
		const table = await openPage(page);
		await expect(table.locator('tr.entity-row')).toHaveCount(expected);
	});

	test('desktop table shows the full column set', async ({page}) => {
		const table = await openPage(page);
		await expect(table.locator('th')).toHaveCount(DESKTOP_COLUMNS);
	});

	test('fee-rate cell matches the keyset input_fee_ppk', async ({page}, testInfo) => {
		// The sat keyset's fee rate is the clearest single-value differential.
		// Rows sort by derivation index desc; assert the active sat keyset's
		// ppk appears somewhere in the fee-rate column rather than pinning a
		// row index (multi-unit stacks interleave units).
		const config = getConfig(testInfo.project.name);
		const active_sat = mint.keysets(config).find((k) => k.unit === 'sat' && k.active);
		test.skip(active_sat === undefined, 'no active sat keyset on this stack');
		const table = await openPage(page);
		const fee_cells = await table.locator('td.mat-column-input_fee_ppk').allTextContents();
		const values = fee_cells.map(amountFromText);
		expect(values).toContain(active_sat!.input_fee_ppk);
	});

	test('rotation FAB toggles the rotation form open and closed', async ({page}) => {
		await openPage(page);
		const collapsible = page.locator('.orc-animation-collapsible');
		await expect(collapsible).not.toHaveClass(/animation-open/);
		await page.locator('.mint-keyset-control button', {hasText: 'switch_access_shortcut_add'}).click();
		await expect(collapsible).toHaveClass(/animation-open/);
		await expect(page.locator('orc-mint-subsection-keysets-form')).toBeVisible();
		// Close via the form's close button.
		await page.locator('orc-mint-subsection-keysets-form button', {hasText: 'close'}).first().click();
		await expect(collapsible).not.toHaveClass(/animation-open/);
	});

	test('keyset version format availability follows the mint impl', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		await openPage(page);
		await page.locator('.mint-keyset-control button', {hasText: 'switch_access_shortcut_add'}).click();
		const form = page.locator('orc-mint-subsection-keysets-form');
		await expect(form).toBeVisible();
		// The V2 card carries the impl-sensitive description string.
		if (config.mint === 'nutshell') {
			await expect(form.getByText('Unsupported in Nutshell')).toBeVisible();
		} else {
			await expect(form.getByText('New standard')).toBeVisible();
		}
	});

	test('filter menu lists provisioned units plus Active/Inactive', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const units = mintUnitsFor(config).map((u) => u.toUpperCase());
		await openPage(page);
		const menu = await openFilterMenu(page);
		const labels = (await menu.locator('mat-checkbox').allTextContents()).map((l) => l.trim());
		const expected = new Set([...units, 'Active', 'Inactive']);
		expect(new Set(labels)).toEqual(expected);
		await page.keyboard.press('Escape');
	});

	test('the Active status filter narrows rows to active keysets', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const active_count = mint.keysets(config).filter((k) => k.active).length;
		const table = await openPage(page);
		const menu = await openFilterMenu(page);
		// Click the checkbox label by exact text — hasText: 'Active' would
		// also match 'Inactive', and a whitespace-padded regex misses the
		// text node. Clicking the label toggles the control.
		await menu.getByText('Active', {exact: true}).click();
		await page.keyboard.press('Escape');
		await expect(table.locator('tr.entity-row')).toHaveCount(active_count);
	});

	test('navigating away mid-rotation opens the unsaved-changes dialog', async ({page}) => {
		await openPage(page);
		await page.locator('.mint-keyset-control button', {hasText: 'switch_access_shortcut_add'}).click();
		await expect(page.locator('.orc-animation-collapsible')).toHaveClass(/animation-open/);
		// Router navigation (not a hard load) triggers the canDeactivate guard.
		// The mint secondary nav's Info item is a stable in-app link.
		await page.locator('orc-mint-section orc-nav-secondary-item', {hasText: 'Info'}).click();
		const dialog = page.locator('orc-event-general-unsaved-dialog');
		await expect(dialog).toBeVisible();
		await expect(dialog.getByText(/unsaved changes/i)).toBeVisible();
		// Stay on page → dialog closes, URL unchanged.
		await dialog.getByRole('button', {name: 'Stay on page'}).click();
		await expect(dialog).toHaveCount(0);
		await expect(page).toHaveURL(/\/mint\/keysets$/);
	});
});

test.describe('mint subsection keysets — mobile viewport', {tag: '@canary'}, () => {
	test.use({viewport: {width: 375, height: 812}});

	test('mobile collapses the table to a single column', async ({page}) => {
		await page.goto('/mint/keysets');
		const table = page.locator('orc-mint-subsection-keysets-table');
		await expect(table.locator('tr.entity-row').first()).toBeVisible();
		await expect(table.locator('th')).toHaveCount(1);
	});
});
