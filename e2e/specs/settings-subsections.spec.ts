/**
 * Feature spec: `/settings/device`, `/settings/app`, `/settings/user`.
 *
 * READ-ONLY. `setup/settings.setup.ts` already drives every control per the
 * stack's settings matrix and bakes the result into storageState — the whole
 * suite depends on that baked state. So this spec asserts page structure and
 * that persisted settings MATCH the matrix; it never re-drives a control,
 * which would desync storageState (device) or the server (app).
 *
 * Coverage:
 *   - device page renders its four sections' cards
 *   - applied theme == config.deviceSettings.theme (document.body class) —
 *     the cleanest cross-stack settings signal, proves the storageState
 *     round-trip survived
 *   - app page renders Bitcoin + AI sections
 *   - the bitcoin-oracle toggle's selected side matches
 *     config.appSettings.bitcoin_oracle
 *   - user page renders User + messaging sections
 *   - mobile viewport collapses the section nav into a Settings menu
 *
 * NOT covered:
 *   - any control write (`disruptive` — covered by settings.setup.ts)
 *   - password dialog (`disruptive`)
 *   - AI live surfaces (`stack-only` — cln-cdk-postgres via e2e:test:ai)
 */

import {test, expect} from '@playwright/test';

import {getConfig} from '@e2e/helpers/config';
import {orchard} from '@e2e/helpers/backend';

test.describe('settings device — /settings/device', {tag: '@all'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/settings/device');
	});

	test('renders the device settings cards', async ({page}) => {
		await expect(page.locator('orc-settings-subsection-device-timezone')).toBeVisible();
		await expect(page.locator('orc-settings-subsection-device-locale')).toBeVisible();
		await expect(page.locator('orc-settings-subsection-device-theme')).toBeVisible();
		await expect(page.locator('orc-settings-subsection-device-currency')).toHaveCount(2);
		await expect(page.locator('orc-settings-subsection-device-ai')).toBeVisible();
	});

	test('applied theme matches the stack settings matrix', async ({page}, testInfo) => {
		// setTheme() writes the theme as a class on document.body. On a stack
		// whose matrix set a theme, that class is deterministic; canary sets
		// no theme so it falls back to a system default — skip there.
		const config = getConfig(testInfo.project.name);
		test.skip(!config.deviceSettings?.theme, 'no theme in this stack settings matrix');
		await expect(page.locator('orc-settings-subsection-device-theme')).toBeVisible();
		const body_class = await page.evaluate(() => document.body.className);
		expect(body_class).toContain(config.deviceSettings!.theme!);
	});
});

test.describe('settings app — /settings/app', {tag: '@all'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/settings/app');
	});

	test('renders the app settings sections', async ({page}) => {
		await expect(page.locator('orc-settings-subsection-app-bitcoin')).toBeVisible();
		await expect(page.locator('orc-settings-subsection-app-ai')).toBeVisible();
	});

	test('bitcoin-oracle toggle reflects the settings table', async ({page}, testInfo) => {
		// The oracle card renders two `orc-form-toggle`s (Disabled / Enabled);
		// exactly one carries `.selected`. Differential: it must mirror the
		// SERVER's `bitcoin.oracle` settings row (unset → default off) — NOT
		// the static stack matrix, which only records what settings.setup
		// seeded and goes stale the moment an operator (or a mutation spec)
		// flips the toggle mid-life. Drift-proof by construction.
		const config = getConfig(testInfo.project.name);
		const oracle = page.locator('orc-settings-subsection-app-bitcoin-oracle');
		await expect(oracle).toBeVisible();
		const selected = oracle.locator('.form-toggle.selected');
		await expect(selected).toHaveCount(1);
		const expected_label = orchard.setting(config, 'bitcoin.oracle') === 'true' ? 'Enabled' : 'Disabled';
		await expect(selected).toContainText(expected_label);
	});
});

test.describe('settings user — /settings/user', {tag: '@all'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/settings/user');
	});

	test('renders the user settings sections', async ({page}) => {
		await expect(page.locator('orc-settings-subsection-user-user')).toBeVisible();
		await expect(page.locator('orc-settings-subsection-user-messaging')).toBeVisible();
	});
});

test.describe('settings — mobile viewport', {tag: '@canary'}, () => {
	test.use({viewport: {width: 375, height: 812}});

	test('mobile collapses the section nav into a Settings menu', async ({page}) => {
		await page.goto('/settings/device');
		const settings_btn = page.locator('.mobile-settings-nav button', {hasText: 'Settings'});
		await expect(settings_btn).toBeVisible();
		await settings_btn.click();
		await expect(page.locator('.cdk-overlay-container .mat-mdc-menu-panel')).toBeVisible();
		await page.keyboard.press('Escape');
	});
});
