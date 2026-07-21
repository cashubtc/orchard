/**
 * Feature spec: `orc-bitcoin-subsection-oracle` — the `/bitcoin/oracle` page:
 * the UTXOracle price feed, its latest reading, and the Backfill Prices flow.
 *
 * The live-feed tests are config-gated to the one stack that enables the
 * oracle + wires a real mainnet bitcoind: `cln-nutshell-postgres` (`@oracle`
 * + `@mainchain`). The Oracle nav tab is now FIXED (always rendered); when the
 * bitcoin_oracle setting is off the route falls through to the disabled stub.
 * A `@canary` block below covers that stub on the oracle-off canary stack
 * (`lnd-nutshell-sqlite`) — mirroring mint-subsection-system's split.
 *
 * `oracle.setup.ts` has already run Backfill for yesterday and stored a
 * price, so the Latest Price surface is populated. This spec is READ-ONLY:
 * it asserts the displayed latest price matches the DB oracle and that the
 * backfill form opens/closes — it never runs another backfill (a mutation
 * the setup already owns).
 *
 * Coverage:
 *   - latest price value matches orchard.oraclePrice (daemon DB)
 *   - Latest Price date label + UTC marker render
 *   - the Backfill Prices FAB toggles the collapsible backfill form
 *   - the price chart canvas renders
 *
 * NOT covered:
 *   - running a backfill (`disruptive` — owned by oracle.setup.ts)
 *   - AI-assisted date selection (`stack-only` — needs @ai + this stack)
 */

import {test, expect, type Page} from '@playwright/test';

import {getConfig} from '@e2e/helpers/config';
import {orchard} from '@e2e/helpers/backend';
import {requireReady, oracleHasRecentData} from '@e2e/helpers/ui/readiness';

function amountFromText(text: string | null | undefined): number {
	const stripped = (text ?? '').replace(/\D/g, '');
	return stripped === '' ? 0 : parseInt(stripped, 10);
}

async function openOracle(page: Page): Promise<void> {
	await expect(page.locator('orc-bitcoin-subsection-oracle')).toBeVisible();
}

test.describe('bitcoin subsection oracle — /bitcoin/oracle', {tag: '@oracle'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/bitcoin/oracle');
		// oracle.setup staged yesterday's price; gate on the feed having rows
		// so a slow archive doesn't flake the differential.
		await requireReady(page, oracleHasRecentData);
	});

	test('latest price matches the stored oracle price', async ({page}, testInfo) => {
		// Differential: the card renders `${{ latest_oracle().price | number }}`.
		// orchard.oraclePrice reads the newest utxoracle.price row directly.
		const config = getConfig(testInfo.project.name);
		const expected = orchard.oraclePrice(config);
		expect(expected, 'oracle.setup should have stored a price').not.toBeNull();
		await openOracle(page);
		// The desktop Latest Price block renders the `$<price>` in a
		// font-size-xxl span; the number pipe strips to the integer USD/BTC.
		const price_el = page.locator('orc-bitcoin-subsection-oracle .font-size-xxl').first();
		await expect(price_el).toBeVisible();
		expect(amountFromText(await price_el.textContent())).toBe(expected);
	});

	test('renders the Latest Price date label with a UTC marker', async ({page}) => {
		await openOracle(page);
		await expect(page.locator('orc-bitcoin-subsection-oracle').getByText('Latest Price').first()).toBeVisible();
		await expect(page.locator('orc-bitcoin-subsection-oracle').getByText('UTC').first()).toBeVisible();
	});

	test('the Backfill Prices FAB toggles the backfill form', async ({page}) => {
		await openOracle(page);
		const collapsible = page.locator('orc-bitcoin-subsection-oracle .orc-animation-collapsible');
		await expect(collapsible).not.toHaveClass(/animation-open/);
		await page.locator('orc-bitcoin-subsection-oracle button', {hasText: 'Backfill Prices'}).click();
		await expect(collapsible).toHaveClass(/animation-open/);
		await expect(page.locator('orc-bitcoin-subsection-oracle-form')).toBeVisible();
		// Close without running a backfill.
		await page.locator('orc-bitcoin-subsection-oracle-form button', {hasText: 'close'}).first().click();
		await expect(collapsible).not.toHaveClass(/animation-open/);
	});

	test('renders the price chart canvas', async ({page}) => {
		await openOracle(page);
		await expect(page.locator('orc-bitcoin-subsection-oracle-chart canvas')).toBeVisible();
	});
});

test.describe('bitcoin subsection oracle disabled — bitcoin_oracle off', {tag: '@canary'}, () => {
	// Canary (lnd-nutshell-sqlite) never turns the oracle on, so `bitcoin_oracle`
	// is false. The nav is fixed (Oracle tab always shown), but the route's
	// bitcoinOracleGuard canMatch fails and falls through to the stub module.
	test('the Oracle tab is present but routes to the disabled stub', async ({page}) => {
		await page.goto('/bitcoin', {waitUntil: 'networkidle'});
		const tab = page.locator('orc-bitcoin-section orc-nav-secondary-item', {hasText: 'Oracle'});
		await expect(tab).toBeVisible();
		await tab.click();
		await expect(page).toHaveURL(/\/bitcoin\/oracle$/);
		const stub = page.locator('orc-bitcoin-subsection-oracle-disabled');
		await expect(stub).toBeVisible();
		await expect(stub.locator('orc-public-docs-link-card')).toBeVisible();
		// The real oracle component must NOT load when the setting is off.
		await expect(page.locator('orc-bitcoin-subsection-oracle')).toHaveCount(0);
	});

	test('direct /bitcoin/oracle renders the disabled stub', async ({page}) => {
		await page.goto('/bitcoin/oracle', {waitUntil: 'networkidle'});
		const stub = page.locator('orc-bitcoin-subsection-oracle-disabled');
		await expect(stub).toBeVisible();
		await expect(stub.locator('orc-public-docs-link-card')).toBeVisible();
		await expect(page.locator('orc-bitcoin-subsection-oracle')).toHaveCount(0);
	});
});
