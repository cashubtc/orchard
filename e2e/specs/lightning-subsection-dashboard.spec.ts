/**
 * Feature spec: `orc-lightning-subsection-dashboard` — the routed body of
 * `/lightning`, plus the `orc-lightning-section` chrome that hosts it.
 *
 * The body is a placeholder stub today (bolt icon + "Lightning Dashboard
 * Coming Soon!"), so the meat of this spec is the section wrapper: the
 * secondary-nav header (alias + colour dot fed by the `lightning_info`
 * query), the implementation version string in the toolbar, the active
 * "Dashboard" nav item, and the more-menu (Logout).
 *
 * Coverage:
 *   - stub body: container mounts, bolt icon + static text render
 *   - header: alias + version match `ln.getInfo` on the orchard-side node
 *   - header dot: inline colour matches `ln.getInfo().color` — LND only
 *     (cln's `mapClnInfo` strips the `#` so the dot renders transparent;
 *     known bug, asserted-nothing on cln until the normalization lands)
 *   - nav item: "Dashboard" renders highlighted on `/lightning`
 *   - more-menu: opens with exactly one Logout item, closes on Escape
 *
 * States the page supports but this spec does NOT cover:
 *   - header blank pre-resolve / on query error (`unit-better` — sub-second
 *     transient, template renders empty strings via optional chaining)
 *   - disabled redirect to `/lightning/disabled` (`stack-only` — covered by
 *     the disabled-subsections spec on fake-cdk-postgres via @no-lightning)
 *   - Logout menu item click (`disruptive` — revokes the storageState token
 *     every sibling spec shares; belongs to an isolated-context auth spec)
 *   - "Dashboard" nav item click (known-bug — `navroute="mint"` sends the
 *     user to `/mint`; assert the destination only after the fix lands)
 */

import {test, expect, type Locator, type Page} from '@playwright/test';

import {getConfig} from '@e2e/helpers/config';
import {ln} from '@e2e/helpers/backend';

/** Shape of the `getinfo` fields this spec reads — both impls emit all
 *  three (cln's `color` arrives bare-hex, lnd's with the leading `#`). */
type NodeIdentity = {alias: string; color: string; version: string};

function nodeIdentity(project_name: string): NodeIdentity {
	const config = getConfig(project_name);
	return ln.getInfo(config) as NodeIdentity;
}

/** `#rrggbb` → `rgb(r, g, b)` — the form getComputedStyle serialises to. */
function hexToRgb(hex: string): string {
	const h = hex.replace(/^#/, '');
	const r = parseInt(h.slice(0, 2), 16);
	const g = parseInt(h.slice(2, 4), 16);
	const b = parseInt(h.slice(4, 6), 16);
	return `rgb(${r}, ${g}, ${b})`;
}

async function openSection(page: Page): Promise<Locator> {
	// One mount per page — scope everything under the section host so a
	// stray second render surfaces as a strict-mode failure.
	const section = page.locator('orc-lightning-section');
	await expect(section).toBeVisible();
	return section;
}

test.describe('lightning subsection dashboard — /lightning', {tag: '@lightning'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/lightning');
	});

	test('renders the placeholder stub body', async ({page}) => {
		// The routed body is static: one container, one bolt icon, one line
		// of text. When the real dashboard replaces the stub this test is
		// the tripwire that says "rewrite lightning-subsection-dashboard
		// coverage" — expect it to fail loudly, not linger green.
		const stub = page.locator('orc-lightning-subsection-dashboard .lightning-dashboard-container');
		await expect(stub).toBeVisible();
		await expect(stub.locator('mat-icon')).toHaveText('bolt');
		await expect(stub.getByText('Lightning Dashboard Coming Soon!', {exact: true})).toBeVisible();
	});

	test('header alias matches the orchard-side node alias', async ({page}, testInfo) => {
		// Differential: the header binds `lightning_info?.alias`, which the
		// server maps 1:1 from getinfo on both impls. Both e2e topologies
		// name the orchard-side node "orchard", but read the oracle rather
		// than hard-coding so an alias change in the fixtures stays green.
		const identity = nodeIdentity(testInfo.project.name);
		const section = await openSection(page);
		await expect(section.locator('.nav-secondary-header .text-nowrap')).toHaveText(identity.alias);
	});

	test('toolbar shows the LN implementation version string', async ({page}, testInfo) => {
		// `{{ lightning_info?.version }}` is a raw passthrough: lnd emits
		// "0.20.0-beta commit=v0.20.0-beta", cln emits "v25.12". The oracle
		// keeps this assertion impl-agnostic.
		const identity = nodeIdentity(testInfo.project.name);
		const section = await openSection(page);
		await expect(section.locator('.section-implementation')).toHaveText(identity.version);
	});

	test('header dot renders the node colour (lnd)', async ({page}, testInfo) => {
		// cln's `mapClnInfo` strips the `#` from getinfo's colour, so the
		// client binds an invalid CSS value and the dot renders transparent
		// on cln stacks — skip there until the server normalizes the format.
		const config = getConfig(testInfo.project.name);
		test.skip(config.ln !== 'lnd', 'known bug: cln colour arrives without # and the dot renders transparent');
		const identity = nodeIdentity(testInfo.project.name);
		const section = await openSection(page);
		// The dot's background-color binds to `lightning_info.color`, which
		// loads async — wait for the alias (same signal source) to populate
		// first, else the dot reads transparent under parallel load.
		await expect(section.locator('.nav-secondary-header .text-nowrap')).toHaveText(identity.alias);
		const dot = section.locator('.nav-secondary-header .h-2.w-2');
		await expect(dot).toBeVisible();
		// Poll the computed colour until the binding settles to the node colour.
		await expect
			.poll(async () => dot.evaluate((el) => getComputedStyle(el).backgroundColor))
			.toBe(hexToRgb(identity.color));
	});

	test('the Dashboard nav item is highlighted on /lightning', async ({page}) => {
		// `active_sub_section()` resolves 'dashboard' from the route data,
		// which flips `[active]` and with it the highlight class. There is
		// exactly one nav item in this section today.
		const section = await openSection(page);
		const item = section.locator('orc-nav-secondary-item .secondary-nav-item-container');
		await expect(item).toHaveCount(1);
		await expect(item).toHaveText('Dashboard');
		await expect(item).toHaveClass(/secondary-nav-item-highlight/);
	});

	test('more-menu opens with a single Logout item and closes on Escape', async ({page}) => {
		// Open/close only — actually clicking Logout revokes the shared
		// storageState token and would knock out every spec behind it.
		const section = await openSection(page);
		await section.locator('orc-nav-secondary-more button').click();
		const menu_items = page.locator('.cdk-overlay-container .mat-mdc-menu-item');
		await expect(menu_items).toHaveCount(1);
		await expect(menu_items).toContainText('Logout');
		await page.keyboard.press('Escape');
		await expect(page.locator('.cdk-overlay-container .mat-mdc-menu-panel')).toHaveCount(0);
	});
});
