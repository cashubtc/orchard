/**
 * Feature spec: `orc-bitcoin-subsection-oracle` — the `/bitcoin/oracle` page:
 * the UTXOracle price feed, its latest reading, and the Backfill Prices flow.
 *
 * Config-gated to the one stack that enables the oracle + wires a real
 * mainnet bitcoind: `cln-nutshell-postgres` (`@oracle` + `@mainchain`). On
 * every other stack the nav item and route don't exist, so these tests match
 * zero projects and are skipped by grep.
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
