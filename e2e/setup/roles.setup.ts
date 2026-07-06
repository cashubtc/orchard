/**
 * Role provisioning — canary only. Creates the READER user through the
 * real operator flow, exactly as a user would add crew to their Orchard:
 *
 *   1. admin opens /crew and creates a Reader invite via the invite form
 *      (FAB → pre-filled form → confirm the event-stack Save chip)
 *   2. admin reads the invite token off the expanded invite row
 *   3. the invitee signs up at /auth/signup with the token (fresh,
 *      logged-out context) — signup authenticates immediately
 *   4. the reader's storage state persists to
 *      `e2e/.auth/<config>.reader.json` for `*.reader.spec.ts` files
 *
 * Idempotent across runs: if the reader can already log in, we just
 * refresh the storage state and skip provisioning — mirroring
 * auth.setup.ts's "fresh stacks run setup, initialized stacks log in".
 * Roles are Orchard-level (its own user table), independent of the
 * bitcoin/LN/mint backends, so exercising this on one stack covers it;
 * the reader project only exists for canary in playwright.config.ts.
 */

import {test as setup, expect, type Browser, type Page} from '@playwright/test';

import {TEST_READER} from '@e2e/helpers/config';

function readerStatePath(project_name: string): string {
	const bare = project_name.replace(/^roles-/, '').replace(/:\d+$/, '');
	return `e2e/.auth/${bare}.reader.json`;
}

/** Try to authenticate as the reader in a fresh (logged-out) context.
 *  Returns the page on success (caller saves storage state), null when
 *  the login is rejected (reader not provisioned yet). */
async function tryReaderLogin(browser: Browser, baseURL: string): Promise<Page | null> {
	const context = await browser.newContext({baseURL});
	const page = await context.newPage();
	await page.goto('/auth', {waitUntil: 'networkidle'});
	await page.getByLabel('Username').fill(TEST_READER.name);
	await page.getByLabel('Password', {exact: true}).fill(TEST_READER.password);
	await page.getByLabel('Password', {exact: true}).press('Enter');
	try {
		await expect(page).not.toHaveURL(/\/auth/, {timeout: 4000});
		return page;
	} catch {
		await context.close();
		return null;
	}
}

setup('provision reader role via the crew UI', {tag: '@canary'}, async ({page, browser, baseURL}, testInfo) => {
	const state_path = readerStatePath(testInfo.project.name);

	// Already provisioned on this stack? Just refresh the reader state.
	const existing = await tryReaderLogin(browser, baseURL!);
	if (existing) {
		await existing.context().storageState({path: state_path});
		await existing.context().close();
		return;
	}

	// ── 1. As admin (project storageState): create a Reader invite ──
	await page.goto('/crew');
	await expect(page.locator('orc-index-subsection-crew-table tr.entity-row').first()).toBeVisible();

	// The FAB opens the invite form pre-filled valid: role defaults to
	// Reader, expiration defaults to 8h out — nothing to type.
	await page.locator('orc-index-subsection-crew button', {hasText: 'person_add'}).click();
	await expect(page.locator('orc-index-subsection-crew .orc-animation-collapsible').first()).toHaveClass(/animation-open/);

	// Opening the form registered a PENDING Save event — confirm it via
	// the global event chip (same recipe as mint-subsection-info.spec.ts).
	await page.locator('orc-event-general-nav-tool:visible').first().locator('.event-nav-tool').click();
	await expect(
		page.locator('orc-event-general-stack orc-event-general-stack-message .event-message-content').filter({hasText: 'Invite created'}),
	).toBeVisible();

	// ── 2. Read the token off the new invite's expanded row ──
	// Invite rows render a "pending" italic + role text instead of a user
	// chip; expanding one mounts orc-index-subsection-crew-table-invite,
	// whose .mega-string is the raw token. The SUCCESS handler prepends the
	// new invite and rebuilds the data source, so a click landed right after
	// the toast can hit a detached row — wait for the toast to clear, then
	// retry the expand until the detail actually mounts.
	await expect(
		page.locator('orc-event-general-stack orc-event-general-stack-message .event-message-content'),
	).toHaveCount(0);
	const invite_row = page.locator('orc-index-subsection-crew-table tr.entity-row', {hasText: 'pending'}).first();
	await expect(invite_row).toBeVisible();
	// Two .mega-strings render in the detail: the "Invite link" URL first,
	// the raw "Invite key" token second — the signup form wants the token.
	const token_el = page.locator('orc-index-subsection-crew-table-invite .mega-string').last();
	await expect(async () => {
		await invite_row.click();
		await expect(token_el).toBeVisible({timeout: 1_500});
	}).toPass({timeout: 15_000});
	const token = ((await token_el.textContent()) ?? '').trim();
	expect(token, 'invite token should be non-empty').not.toBe('');
	expect(token, 'token span should hold the raw key, not the signup URL').not.toContain('/');

	// ── 3. Sign up as the reader in a fresh logged-out context ──
	// Signup stores the auth tokens on success and navigates to `/`, so
	// the new context is authenticated as the reader when it lands.
	const reader_context = await browser.newContext({baseURL});
	const reader_page = await reader_context.newPage();
	await reader_page.goto('/auth', {waitUntil: 'networkidle'});
	await reader_page.getByRole('link', {name: 'Sign up'}).click();
	const form = reader_page.locator('orc-auth-subsection-signup-form');
	await expect(form).toBeVisible();
	// The signup formcontrols don't wire aria labels — fill by position: key, name,
	// password, confirm.
	const inputs = form.locator('input');
	await inputs.nth(0).fill(token);
	await inputs.nth(1).fill(TEST_READER.name);
	await inputs.nth(2).fill(TEST_READER.password);
	await inputs.nth(3).fill(TEST_READER.password);
	await form.getByRole('button', {name: 'Sign Up'}).click();
	await expect(reader_page).not.toHaveURL(/\/auth/);

	// ── 4. Persist the reader storage state ──
	await reader_context.storageState({path: state_path});
	await reader_context.close();
});
