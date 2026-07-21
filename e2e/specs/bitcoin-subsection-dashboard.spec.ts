/**
 * Feature spec: `orc-bitcoin-subsection-dashboard` — the routed body of
 * `/bitcoin`, plus the `orc-bitcoin-section` chrome hosting it.
 *
 * The body is a placeholder stub (bitcoin svg-icon + "Bitcoin Dashboard
 * Coming Soon!"). The real surface is the section wrapper: chain name +
 * node subversion in the header (differential against bitcoind), and the
 * two always-present nav items ("Dashboard" + "Oracle"). The Oracle tab is
 * now FIXED — always rendered regardless of the bitcoin_oracle setting; when
 * the setting is off the route falls through to the disabled stub (covered by
 * bitcoin-subsection-oracle's @canary block).
 *
 * Coverage:
 *   - stub body renders
 *   - header chain == btc.getBlockchainInfo().chain
 *   - header subversion == btc.getNetworkInfo().subversion
 *   - Oracle nav item is always present (fixed nav)
 *
 * NOT covered:
 *   - route-overlay spinner (`unit-better` — transient)
 *   - disabled redirect (`stack-only` — disabled-subsections spec)
 *   - Logout (`disruptive`)
 *   - bitcoin data cards (rendered on `/`, owned by their own specs)
 */

import {test, expect, type Locator, type Page} from '@playwright/test';

import {getConfig} from '@e2e/helpers/config';
import {btc} from '@e2e/helpers/backend';

async function openSection(page: Page): Promise<Locator> {
	const section = page.locator('orc-bitcoin-section');
	await expect(section).toBeVisible();
	return section;
}

test.describe('bitcoin subsection dashboard — /bitcoin', {tag: '@bitcoin'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/bitcoin');
	});

	test('renders the placeholder stub body', async ({page}) => {
		const stub = page.locator('orc-bitcoin-subsection-dashboard .bitcoin-dashboard-container');
		await expect(stub).toBeVisible();
		await expect(stub.locator('mat-icon')).toHaveCount(1);
		await expect(stub.getByText('Bitcoin Dashboard Coming Soon!', {exact: true})).toBeVisible();
	});

	test('header chain matches bitcoind getblockchaininfo', async ({page}, testInfo) => {
		// The mainchain stack wires Orchard to a REAL mainnet bitcoind (its
		// compose.mainchain.yml overlay), so the UI reports `main` while the
		// btc helper reads the stack's regtest container — they legitimately
		// disagree. On mainchain, just assert a non-empty chain string.
		const config = getConfig(testInfo.project.name);
		const section = await openSection(page);
		const header = section.locator('.nav-secondary-header .text-nowrap');
		if (config.mainchain) {
			await expect(header).not.toBeEmpty();
		} else {
			await expect(header).toHaveText(btc.getBlockchainInfo(config).chain as string);
		}
	});

	test('toolbar subversion matches bitcoind getnetworkinfo', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const section = await openSection(page);
		const impl = section.locator('.section-implementation');
		if (config.mainchain) {
			// Same mainnet-vs-regtest split as the chain assertion.
			await expect(impl).not.toBeEmpty();
		} else {
			await expect(impl).toHaveText(btc.getNetworkInfo(config).subversion as string);
		}
	});

	test('Oracle nav item is always present in the bitcoin section nav', async ({page}) => {
		// The Oracle tab is now FIXED — always rendered regardless of the
		// bitcoin_oracle setting. On stacks with the oracle off the route falls
		// through to the disabled stub (asserted in bitcoin-subsection-oracle
		// @canary); here we only assert the nav chrome renders both tabs.
		const section = await openSection(page);
		await expect(section.locator('orc-nav-secondary-item', {hasText: 'Dashboard'})).toBeVisible();
		await expect(section.locator('orc-nav-secondary-item', {hasText: 'Oracle'})).toBeVisible();
	});
});
