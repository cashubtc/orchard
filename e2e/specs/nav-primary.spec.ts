/**
 * Feature spec: the navigation chrome — desktop rail (`orc-nav-primary`),
 * the AI sidenav's config gating, and the mobile bottom-sheet menus
 * (`orc-nav-mobile-sheet-menu-section` / `-subsection`). Every page spec
 * uses `page.goto`; this is the one place the CLICK-driven navigation
 * surface itself is exercised.
 *
 * Coverage split:
 *   - @canary rail walk: click each enabled section item, assert the router
 *     lands on its route (lazy chunks make the URL flip late — generous
 *     toHaveURL timeouts, the stale-bundle lesson from the lightning
 *     navroute regression).
 *   - @all AI sidenav differential: `orc-ai-nav` mounts iff the server's
 *     `ai.enabled` setting is 'true' (layout-interior gates on it) — pivots
 *     on Orchard's settings table, so the same test asserts presence on the
 *     AI stack and absence elsewhere.
 *   - @canary mobile sheets: the section sheet opens from the header, lists
 *     the section links, and navigates; the subsection sheet opens from the
 *     Menu item.
 *
 * Nothing here mutates anything — pure navigation. Rerun-green trivially.
 *
 * Deliberately NOT covered:
 *   - per-section active-highlight class (`.primary-nav-item-highlight`
 *     applies on hover as well as active — asserting it right after a click
 *     is tautological; the URL is the truthful signal).
 *   - disabled-section nav behavior on the fake stack (owned by
 *     disabled-subsections.spec.ts).
 */

import {test, expect, type Locator, type Page} from '@playwright/test';

import {getConfig} from '@e2e/helpers/config';
import {orchard} from '@e2e/helpers/backend';

function railItem(page: Page, label: string): Locator {
	return page.locator('.primary-nav-item-container', {hasText: label});
}

test.describe('nav — desktop rail walk', {tag: '@canary'}, () => {
	test('each section item routes to its section', async ({page}) => {
		await page.goto('/', {waitUntil: 'networkidle'});

		for (const section of [
			{label: 'Bitcoin', url: /\/bitcoin/},
			{label: 'Lightning', url: /\/lightning/},
			{label: 'Mint', url: /\/mint/},
			{label: 'Ecash', url: /\/ecash/},
		] as const) {
			await railItem(page, section.label).click();
			await expect(page, `${section.label} rail item should route`).toHaveURL(section.url, {timeout: 15_000});
		}
	});
});

test.describe('nav — AI sidenav gating', {tag: '@all'}, () => {
	test('orc-ai-nav mounts iff the ai.enabled setting is true', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const ai_enabled = orchard.setting(config, 'ai.enabled') === 'true';

		await page.goto('/', {waitUntil: 'networkidle'});
		await expect(page.locator('orc-ai-nav')).toHaveCount(ai_enabled ? 1 : 0);
	});
});

test.describe('nav — mobile sheet menus', {tag: '@canary'}, () => {
	test.use({viewport: {width: 375, height: 812}});

	test('the section sheet opens from the header and navigates; the Menu item opens the subsection sheet', async ({page}) => {
		await page.goto('/', {waitUntil: 'networkidle'});

		// Section sheet: header tap → bottom sheet with one link per section.
		// Both nav variants stay in the DOM — scope to the mobile-mode header
		// (the desktop one is merely hidden at this viewport).
		await page.locator('orc-nav-primary-header[mode="mobile"]').click();
		const section_sheet = page.locator('orc-nav-mobile-sheet-menu-section');
		await expect(section_sheet).toBeVisible();
		await section_sheet.getByRole('link', {name: 'Lightning'}).click();
		await expect(page).toHaveURL(/\/lightning/, {timeout: 15_000});
		await expect(section_sheet).toHaveCount(0);

		// Subsection sheet: Menu tap → the active section's subsection list.
		await page.locator('orc-nav-mobile-item', {hasText: 'Menu'}).click();
		const subsection_sheet = page.locator('orc-nav-mobile-sheet-menu-subsection');
		await expect(subsection_sheet).toBeVisible();
		await expect(subsection_sheet.getByRole('link').first()).toBeVisible();
	});
});
