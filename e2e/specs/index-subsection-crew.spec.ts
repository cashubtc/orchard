/**
 * Feature spec: `orc-index-subsection-crew` — the `/crew` user/invite
 * management page.
 *
 * READ-ONLY. Creating invites and editing users mutate Orchard's own DB
 * (shared by every session), and invite/user teardown is fiddly — so this
 * spec asserts structure, the deterministic seed-admin row, the filter
 * surface, and that the create-invite form opens/closes. It never submits
 * an invite or opens a row's edit dialog.
 *
 * Coverage:
 *   - table renders the User/Label/Created/State columns
 *   - the seed admin (username `admin`, role ADMIN) is present
 *   - the person_add FAB toggles the create-invite collapsible form
 *   - the filter menu exposes State (×3) + Role (×3) checkboxes
 *
 * NOT covered:
 *   - invite submit / user + invite edit dialogs (`disruptive` — mutate the
 *     shared user/invite tables)
 *   - own-admin role edit (`dead-branch` — server-guarded)
 *   - device column internals (`unit-better`)
 */

import {test, expect, type Page} from '@playwright/test';

import {TEST_ADMIN} from '@e2e/helpers/config';

async function openCrew(page: Page): Promise<void> {
	await expect(page.locator('orc-index-subsection-crew-table')).toBeVisible();
	await expect(page.locator('orc-index-subsection-crew-table tr.entity-row').first()).toBeVisible();
}

test.describe('index crew — /crew', {tag: '@all'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/crew');
	});

	test('renders the crew table columns', async ({page}) => {
		await openCrew(page);
		const headers = page.locator('orc-index-subsection-crew-table th');
		// Desktop column set includes an actions column; assert the four
		// data columns are present by text rather than pinning the count.
		for (const col of ['User', 'Label', 'Created', 'State']) {
			await expect(headers.filter({hasText: new RegExp(`^\\s*${col}\\s*$`)})).toHaveCount(1);
		}
	});

	test('lists the seed admin with an ADMIN role', async ({page}) => {
		// Deterministic anchor: every stack ships the e2e admin. The row
		// renders the username and the role text via the crew-member chip.
		await openCrew(page);
		const admin_row = page.locator('orc-index-subsection-crew-table tr.entity-row', {hasText: TEST_ADMIN.name});
		await expect(admin_row).toHaveCount(1);
		await expect(admin_row).toContainText(/ADMIN/i);
	});

	test('the person_add FAB toggles the create-invite form', async ({page}) => {
		await openCrew(page);
		const collapsible = page.locator('orc-index-subsection-crew .orc-animation-collapsible').first();
		await expect(collapsible).not.toHaveClass(/animation-open/);
		await page.locator('orc-index-subsection-crew button', {hasText: 'person_add'}).click();
		await expect(collapsible).toHaveClass(/animation-open/);
		// Close via the form's close button — collapses without submitting.
		await page.locator('.orc-animation-collapsible.animation-open button', {hasText: 'close'}).first().click();
		await expect(collapsible).not.toHaveClass(/animation-open/);
	});

	test('the filter menu exposes State and Role options', async ({page}) => {
		await openCrew(page);
		await page.locator('orc-index-subsection-crew-control button', {hasText: 'Filters'}).click();
		const menu = page.locator('.cdk-overlay-container orc-form-filter-menu');
		await expect(menu).toBeVisible();
		await expect(menu.getByText('State', {exact: true})).toBeVisible();
		await expect(menu.getByText('Role', {exact: true})).toBeVisible();
		// State: Active/Inactive/Pending; Role: Admin/Manager/Reader.
		await expect(menu.locator('mat-checkbox')).toHaveCount(6);
		await page.keyboard.press('Escape');
	});
});
