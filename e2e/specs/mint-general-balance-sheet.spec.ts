/**
 * Feature spec: `orc-mint-general-balance-sheet` — the "Balance Sheet" card
 * on the dashboard (`/`) summarising assets vs. liabilities for each Cashu
 * mint unit. Same component is reused on `/mint`; the dashboard tile is
 * the canonical surface every spec navigates to in `beforeEach`.
 *
 * Coverage by tag (project grep wires each describe to the right stacks):
 *   - `@mint`: structure that holds on every stack — title, one card per
 *     provisioned mint unit (driven by `mintUnitsFor(config)`), the row's
 *     "Unspent ecash" liabilities sublabel, the click-to-expand toggle, and
 *     the always-present Mint unit high-card inside the expanded panel.
 *   - `@lightning`: the bitcoin-row branch — Lightning local capacity
 *     sublabel, the desktop-only visual stacks, the inline keyset chip
 *     in `.toggle-cell`, three high-cards in the expanded panel, and the
 *     no-oracle default (only checked when `appSettings.bitcoin_oracle`
 *     is unset for this stack).
 *   - `@no-lightning`: only fake-cdk-postgres — every row's Assets cell
 *     collapses to a "Lightning Configuration" button, and clicking it
 *     navigates to /lightning via the parent's `(navigate)` handler.
 *   - `@oracle`: only cln-nutshell-postgres — the expanded bitcoin row
 *     surfaces the `.orc-primary-card` Oracle subcard with header text.
 *   - Multi-unit fiat rows are exercised opportunistically — tests that
 *     read the USD or EUR row `test.skip` when `mintUnitsFor(config)`
 *     doesn't include them.
 *
 * States the component supports but this spec does NOT cover:
 *   - lightning_loading transient (race-prone — better in Karma)
 *   - lightning_errors render path (requires `docker pause` — disruptive)
 *   - empty-keysets state (both mint daemons auto-provision a sat keyset)
 *   - reserve `< 1` insolvent state (regtest fund-topology never sets up)
 *   - amount-fidelity differential against the LN node's channel local
 *     balance (`ln.localChannelBalance(config)` helper not in
 *     e2e/helpers/backend.ts yet).
 */

import {test, expect, type Locator, type Page} from '@playwright/test';

import {getConfig, mintUnitsFor} from '@e2e/helpers/config';
import {ln, mint, orchard} from '@e2e/helpers/backend';
import {oracleHasRecentData, requireReady} from '@e2e/helpers/ui/readiness';

async function openSheet(page: Page): Promise<Locator> {
	// Both `/` (dashboard tile) and `/mint` (subsection dashboard) host one
	// instance — `.first()` is defensive for future surfaces that mount it
	// elsewhere on the same page.
	const sheet = page.locator('orc-mint-general-balance-sheet').first();
	await expect(sheet).toBeVisible();
	return sheet;
}

/** Parse an integer amount out of rendered text. The localAmount pipe wraps
 *  the value in glyph/locale formatting (e.g. "₿ 2,095", "$24.98"); stripping
 *  non-digits recovers the underlying integer the bs row stores (sat for
 *  bitcoin units, cents for fiat). Returns 0 for empty/null text so callers
 *  testing the legitimate "no value" case don't trip on NaN. */
function amountFromText(text: string | null | undefined): number {
	const stripped = (text ?? '').replace(/\D/g, '');
	return stripped === '' ? 0 : parseInt(stripped, 10);
}

/** Mirror of `oracleConvertToUSDCents(_, _, 'sat')` from the client's oracle
 *  helpers — round(sat / 1e8 × price × 100). Source-of-truth oracle for the
 *  bs's three converted figures inside the Oracle subcard. */
function satToUsdCents(sat: number, price: number): number {
	return Math.round((sat / 100_000_000) * price * 100);
}

/** Wait for the row block to settle. The component sets `rows()` inside an
 *  `ngOnChanges` reaction to `loading=false` / `lightning_balance` / oracle
 *  price; the parent dashboard tile is wrapped in `@if (!loading())` so the
 *  card may mount before its rows are rendered. Card existence ⇒ wait for
 *  at least one `.balance-sheet-card` for stacks that have keysets.
 *
 *  Timeout bumped to 20s — under parallel-stack contention (5 stacks
 *  share one Playwright worker pool) the slower stacks can take well over
 *  the default 5s `expect` window for the dashboard's mint queries to
 *  resolve and the parent's `loading()` to flip false. */
async function waitForRows(sheet: Locator): Promise<void> {
	await expect(sheet.locator('.balance-sheet-card').first()).toBeVisible({timeout: 20_000});
}

/** Wait for the bitcoin row's assets cell to *settle*. The cell goes through
 *  three states: empty (lightning_loading=true), amount-rendered (assets
 *  populated from `lightning_balance.open.local_balance`), or stuck-null
 *  (lightning_balance arrived after the first init() and a re-init never
 *  fired). The `lightningBalance` query is part of a forkJoin with four
 *  other LN queries in `index-subsection-dashboard.component.ts:320` — on
 *  cln-* stacks (mainchain overlay, slow `listpeerchannels`) and under
 *  parallel-stack load this can take ~10–15s. Wait up to 25s for the
 *  amount text inside `.orc-amount`. */
async function waitForBitcoinAssetsSettled(row: Locator): Promise<void> {
	await expect(row.locator('.assets-cell .orc-amount').first()).toBeVisible({timeout: 25_000});
}

/** Bitcoin row sorts first via `currency_order` (sat=2, msat=3, usd=4, eur=5).
 *  Both nutshell and cdk default to `sat`, so this is deterministic on every
 *  current stack. */
function bitcoinRow(sheet: Locator): Locator {
	return sheet.locator('.balance-sheet-card').first();
}

/** Find a row by its keyset chip's `unit | localUnit` rendered text. The
 *  chip lives inside `.toggle-cell` on desktop and inside
 *  `.balance-sheet-details` on tablet/mobile; either way it's scoped to the
 *  correct row's `.balance-sheet-card`. */
function rowByUnit(sheet: Locator, unit: 'sat' | 'usd' | 'eur'): Locator {
	const upper = unit.toUpperCase();
	return sheet.locator('.balance-sheet-card').filter({
		has: sheet.page().locator(`.orc-high-card`, {hasText: new RegExp(`^${upper}\\s*Mint unit`, 'i')}),
	});
}

test.describe('mint-general-balance-sheet — card', {tag: '@mint'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/');
	});

	test('renders the "Balance Sheet" title', async ({page}) => {
		const sheet = await openSheet(page);
		await expect(sheet.getByText('Balance Sheet', {exact: true})).toBeVisible();
	});

	test('renders one row per provisioned mint unit', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const expected_units = mintUnitsFor(config).length;
		const sheet = await openSheet(page);
		await waitForRows(sheet);
		await expect(sheet.locator('.balance-sheet-card')).toHaveCount(expected_units);
	});

	test('every row shows the "Unspent ecash" liabilities sublabel', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const expected_units = mintUnitsFor(config).length;
		const sheet = await openSheet(page);
		await waitForRows(sheet);
		const sublabels = sheet.locator('.liabilities-cell').getByText('Unspent ecash', {exact: false});
		// The phrase appears as part of "Liabilities  ●  Unspent ecash". One per row.
		await expect(sublabels).toHaveCount(expected_units);
	});

	test('every row liabilities figure equals the mint database balance for that unit', async ({page}, testInfo) => {
		// Differential oracle: read the source-of-truth liability per unit from the
		// mint daemon's database (cdk: keyset_amounts; nutshell: balance view),
		// and assert the rendered figure in each row matches exactly. Both `mintUnitsFor`
		// and the component's `getRows` order rows sat → usd → eur, so unit and
		// row index align. The localAmount pipe scales fiat to its display unit
		// (cents → dollars), but stripping all non-digits from the rendered text
		// recovers the underlying integer the DB holds.
		const config = getConfig(testInfo.project.name);
		const units = mintUnitsFor(config);
		const sheet = await openSheet(page);
		await waitForRows(sheet);
		const cards = sheet.locator('.balance-sheet-card');
		await expect(cards).toHaveCount(units.length);
		for (let i = 0; i < units.length; i++) {
			const unit = units[i];
			const expected = mint.balance(config, unit);
			const ui_text = await cards.nth(i).locator('.liabilities-cell .orc-amount').first().textContent();
			expect(amountFromText(ui_text), `row ${i} (${unit}) liabilities should match mint DB`).toBe(expected);
		}
	});

	test('every row keyset chip matches the highest-index keyset for that unit', async ({page}, testInfo) => {
		// Differential oracle for the chip's three rendered fields:
		//   - "Gen {N}"          ← keyset.derivation_path_index
		//   - "{N} ppk"           ← keyset.input_fee_ppk (suppressed when 0)
		//   - .keyset-active|inactive class on .keyset-status ← keyset.active
		// Mirror the row class's per-unit aggregation: it sorts keysets by
		// `b.derivation_path_index - a.derivation_path_index` (desc), so the row
		// inherits the keyset metadata of the *highest* index for that unit.
		const config = getConfig(testInfo.project.name);
		const units = mintUnitsFor(config);
		const all_keysets = mint.keysets(config);
		const sheet = await openSheet(page);
		await waitForRows(sheet);
		const cards = sheet.locator('.balance-sheet-card');
		await expect(cards).toHaveCount(units.length);
		for (let i = 0; i < units.length; i++) {
			const unit = units[i];
			const expected = all_keysets
				.filter((k) => k.unit === unit)
				.sort((a, b) => b.derivation_path_index - a.derivation_path_index)[0];
			expect(expected, `no keyset for unit ${unit} in mint DB`).toBeDefined();
			const chip = cards.nth(i).locator('orc-mint-general-keyset').first();
			await expect(chip).toContainText(`Gen ${expected!.derivation_path_index}`);
			if (expected!.input_fee_ppk > 0) {
				await expect(chip).toContainText(`${expected!.input_fee_ppk} ppk`);
			} else {
				// Template only renders the ppk span when input_fee_ppk > 0.
				await expect(chip.locator('.mint-keyset-fee span')).toHaveCount(0);
			}
			const status = chip.locator('.keyset-status');
			await expect(status).toHaveClass(expected!.active ? /\bkeyset-active\b/ : /\bkeyset-inactive\b/);
		}
	});

	test('every expanded row Fee revenue figure equals the mint database fees for that unit', async ({page}, testInfo) => {
		// Differential oracle for the per-unit Fee revenue high-card inside the
		// expanded panel. cdk: keyset_amounts.fee_collected; nutshell:
		// keysets.fees_paid — both summed per unit to mirror the component's
		// per-unit aggregation. The card is only present after expansion, so
		// click the row first.
		//
		// Bracketed instead of compared to one read: collected fees only ever
		// grow, and the activity simulator's swaps/melts grow them mid-test, so
		// a lone read taken after the UI snapshot legitimately runs ahead of it
		// (observed as UI 11 vs DB 13). Reloading puts the component's fetch
		// between the two oracle reads, so the rendered figure must land in
		// [before, after]. On an idle mint both reads agree and this is exact
		// equality — the differential keeps its full strength.
		const config = getConfig(testInfo.project.name);
		const units = mintUnitsFor(config);
		const fees_before = units.map((unit) => mint.feesPaid(config, unit));
		await page.reload();
		const sheet = await openSheet(page);
		await waitForRows(sheet);
		const cards = sheet.locator('.balance-sheet-card');
		await expect(cards).toHaveCount(units.length);
		for (let i = 0; i < units.length; i++) {
			const unit = units[i];
			const card = cards.nth(i);
			await card.locator('.balance-sheet-row').click();
			const fee_card = card.locator('.balance-sheet-details .orc-high-card').filter({hasText: 'Fee revenue'});
			await expect(fee_card).toBeVisible();
			const ui_fees = amountFromText(await fee_card.locator('.orc-amount').first().textContent());
			const fees_after = mint.feesPaid(config, unit);
			const label = `row ${i} (${unit}) Fee revenue should match mint DB (expected ${fees_before[i]}..${fees_after})`;
			expect(ui_fees, label).toBeGreaterThanOrEqual(fees_before[i]);
			expect(ui_fees, label).toBeLessThanOrEqual(fees_after);
		}
	});

	test('clicking a row toggles the .animation-expanded class on .balance-sheet-details', async ({page}) => {
		const sheet = await openSheet(page);
		await waitForRows(sheet);
		const row = bitcoinRow(sheet);
		const details = row.locator('.balance-sheet-details');
		const click_target = row.locator('.balance-sheet-row');

		await expect(details).not.toHaveClass(/\banimation-expanded\b/);

		await click_target.click();
		await expect(details).toHaveClass(/\banimation-expanded\b/);

		await click_target.click();
		await expect(details).not.toHaveClass(/\banimation-expanded\b/);
	});

	test('expanded row shows the "Mint unit" high-card', async ({page}) => {
		const sheet = await openSheet(page);
		await waitForRows(sheet);
		const row = bitcoinRow(sheet);
		await row.locator('.balance-sheet-row').click();
		const details = row.locator('.balance-sheet-details');
		await expect(details).toHaveClass(/\banimation-expanded\b/);
		await expect(details.getByText('Mint unit', {exact: true})).toBeVisible();
	});
});

test.describe('mint-general-balance-sheet — bitcoin row', {tag: '@lightning'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/');
	});

	test('shows the "Lightning local capacity" sublabel in the assets cell', async ({page}) => {
		const sheet = await openSheet(page);
		await waitForRows(sheet);
		const row = bitcoinRow(sheet);
		await waitForBitcoinAssetsSettled(row);
		await expect(row.locator('.assets-cell').getByText('Lightning local capacity', {exact: false})).toBeVisible();
	});

	test('assets cell amount equals the LN node local channel balance', async ({page}, testInfo) => {
		// Differential oracle: read the source-of-truth open-channel local balance
		// from the orchard-side LN node and assert the rendered figure matches.
		// LND: `lncli channelbalance.local_balance.sat`. CLN: sum of `to_us_msat`
		// across `CHANNELD_NORMAL` peer channels, truncate-divided by 1000.
		const config = getConfig(testInfo.project.name);
		const sheet = await openSheet(page);
		await waitForRows(sheet);
		const row = bitcoinRow(sheet);
		await waitForBitcoinAssetsSettled(row);
		const expected = ln.localChannelBalance(config);
		const ui_text = await row.locator('.assets-cell .orc-amount').first().textContent();
		expect(amountFromText(ui_text), 'bitcoin row assets should match LN node local balance').toBe(expected);
	});

	test('renders the visual coin stacks on desktop', async ({page}) => {
		// The Visual cell is gated on `device_type === 'desktop' && row.assets !== null`.
		// Default Playwright viewport is desktop. Wait for assets to settle so the
		// `assets !== null` branch holds when the assertion runs.
		const sheet = await openSheet(page);
		await waitForRows(sheet);
		const row = bitcoinRow(sheet);
		await waitForBitcoinAssetsSettled(row);
		await expect(row.locator('orc-mint-general-balance-stacks')).toBeVisible();
	});

	test('inline keyset chip lives inside .toggle-cell on desktop', async ({page}) => {
		const sheet = await openSheet(page);
		await waitForRows(sheet);
		const row = bitcoinRow(sheet);
		await expect(row.locator('.toggle-cell orc-mint-general-keyset')).toBeVisible();
		await expect(row.locator('.toggle-cell').getByText('Active keyset', {exact: true})).toBeVisible();
	});

	test('expanded row shows three high-cards: Mint unit, Liability coverage, Fee revenue', async ({page}) => {
		// `Liability coverage` only renders when `row.assets !== null`. Bitcoin
		// rows always carry assets when LN is enabled — the parent feeds
		// `lightning_balance.open.local_balance`. Wait for assets to settle
		// before clicking, so the row's expanded panel fills in with all three
		// cards (the `assets !== null` gate is read at render time).
		const sheet = await openSheet(page);
		await waitForRows(sheet);
		const row = bitcoinRow(sheet);
		await waitForBitcoinAssetsSettled(row);
		await row.locator('.balance-sheet-row').click();
		const details = row.locator('.balance-sheet-details');
		await expect(details).toHaveClass(/\banimation-expanded\b/);
		const high_cards = details.locator('.orc-high-card');
		await expect(high_cards).toHaveCount(3);
		// Scope text checks to the high-card region. On `@oracle` stacks the
		// expanded panel also renders an `.orc-primary-card` Oracle subcard
		// whose per-figure sublabels include their own "Fee revenue" string —
		// without this scope the bare `getByText('Fee revenue')` resolves to
		// two elements and trips strict mode.
		await expect(high_cards.getByText('Mint unit', {exact: true})).toBeVisible();
		await expect(high_cards.getByText('Liability coverage', {exact: true})).toBeVisible();
		await expect(high_cards.getByText('Fee revenue', {exact: true})).toBeVisible();
	});

	test('expanded row Liability coverage figure equals ceil(assets) / liabilities', async ({page}, testInfo) => {
		// Differential oracle for `row.reserve` (rendered as `{{ row.reserve }}x`
		// inside the Liability coverage high-card). The row class computes:
		//   const multiple = Math.ceil(assets) / liabilities
		//   reserve = multiple < 5 ? Math.round(multiple * 10) / 10 : Math.round(multiple)
		// Both sources flow through helpers we already trust differentially —
		// LN local balance for assets, mint DB for liabilities — so a divergence
		// here would point at the rounding logic in the row class itself.
		const config = getConfig(testInfo.project.name);
		const sheet = await openSheet(page);
		await waitForRows(sheet);
		const row = bitcoinRow(sheet);
		await waitForBitcoinAssetsSettled(row);
		const sat_assets = ln.localChannelBalance(config);
		const sat_liabilities = mint.balance(config, 'sat');
		test.skip(sat_liabilities === 0, 'reserve getter returns null when liabilities are zero — UI hides the card');
		const multiple = Math.ceil(sat_assets) / sat_liabilities;
		const expected = multiple < 5 ? Math.round(multiple * 10) / 10 : Math.round(multiple);

		await row.locator('.balance-sheet-row').click();
		const reserve_card = row.locator('.balance-sheet-details .orc-high-card').filter({hasText: 'Liability coverage'});
		await expect(reserve_card).toBeVisible();
		const ui_text = (await reserve_card.locator('.font-size-l').first().textContent())?.trim() ?? '';
		// Template renders as `{{ row.reserve }}x` — drop the trailing 'x', parseFloat handles both "1.5" and "5".
		const ui_value = parseFloat(ui_text.replace(/x$/, ''));
		expect(ui_value, 'Liability coverage should equal the row class reserve formula').toBe(expected);
	});

	test('expanded row hides the Oracle subcard when the oracle setting is off', async ({page}, testInfo) => {
		// Skip on stacks where the settings setup phase turned the oracle on —
		// the off-default branch is unreachable there, covered by the @oracle
		// describe block below.
		const config = getConfig(testInfo.project.name);
		test.skip(config.appSettings?.bitcoin_oracle === true, 'oracle is on for this stack — see @oracle describe');
		const sheet = await openSheet(page);
		await waitForRows(sheet);
		const row = bitcoinRow(sheet);
		await waitForBitcoinAssetsSettled(row);
		await row.locator('.balance-sheet-row').click();
		const details = row.locator('.balance-sheet-details');
		await expect(details).toHaveClass(/\banimation-expanded\b/);
		await expect(details.locator('.orc-primary-card')).toHaveCount(0);
	});
});

test.describe('mint-general-balance-sheet — fiat rows', {tag: '@mint'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/');
	});

	test('USD row asset cell renders the placeholder dash (LN) or the Lightning Configuration button (no-LN)', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const units = mintUnitsFor(config);
		test.skip(!units.includes('usd'), 'this stack does not provision a USD keyset');
		const sheet = await openSheet(page);
		await waitForRows(sheet);
		// `getRows` sorts btc/sat → usd → eur. With only sat+usd, USD is the
		// second card; with sat+usd+eur, USD is also second.
		const sat_index = units.indexOf('sat');
		const usd_index = units.indexOf('usd');
		const card_index = sat_index < usd_index ? usd_index - sat_index : usd_index;
		const row = sheet.locator('.balance-sheet-card').nth(card_index);
		if (config.ln === false) {
			// On no-LN stacks the assets cell collapses to the Lightning Configuration
			// button for every row regardless of unit (template's @else branch on
			// `lightning_enabled()`).
			await expect(row.locator('.assets-cell button[mat-stroked-button]')).toHaveText('Lightning Configuration');
		} else {
			// `<mat-icon>check_indeterminate_small</mat-icon>` keeps the ligature
			// name in textContent. Filter mat-icons by that text — `orc-graphic-asset`
			// inside the same cell renders other mat-icons (currency_bitcoin, bolt)
			// that we want to ignore.
			await expect(row.locator('.assets-cell mat-icon').filter({hasText: 'check_indeterminate_small'})).toBeVisible();
			await expect(row.locator('.assets-cell .orc-amount')).toHaveCount(0);
		}
	});

	test('EUR row asset cell renders the placeholder dash (LN) or the Lightning Configuration button (no-LN)', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const units = mintUnitsFor(config);
		test.skip(!units.includes('eur'), 'this stack does not provision a EUR keyset');
		const sheet = await openSheet(page);
		await waitForRows(sheet);
		const eur_index = units.indexOf('eur');
		const sat_index = units.indexOf('sat');
		const card_index = sat_index < eur_index ? eur_index - sat_index : eur_index;
		const row = sheet.locator('.balance-sheet-card').nth(card_index);
		if (config.ln === false) {
			await expect(row.locator('.assets-cell button[mat-stroked-button]')).toHaveText('Lightning Configuration');
		} else {
			await expect(row.locator('.assets-cell mat-icon').filter({hasText: 'check_indeterminate_small'})).toBeVisible();
		}
	});

	test('expanded fiat row omits the "Liability coverage" card', async ({page}, testInfo) => {
		// Fiat rows have `row.assets === null`, which gates out the Liability
		// coverage high-card. Mint unit + Fee revenue still render.
		const config = getConfig(testInfo.project.name);
		const units = mintUnitsFor(config);
		test.skip(!units.includes('usd') && !units.includes('eur'), 'this stack has no fiat keyset');
		const sheet = await openSheet(page);
		await waitForRows(sheet);
		const fiat_unit = units.includes('usd') ? 'usd' : 'eur';
		const sat_index = units.indexOf('sat');
		const fiat_index = units.indexOf(fiat_unit);
		const card_index = sat_index < fiat_index ? fiat_index - sat_index : fiat_index;
		const row = sheet.locator('.balance-sheet-card').nth(card_index);
		await row.locator('.balance-sheet-row').click();
		const details = row.locator('.balance-sheet-details');
		await expect(details).toHaveClass(/\banimation-expanded\b/);
		await expect(details.locator('.orc-high-card')).toHaveCount(2);
		await expect(details.getByText('Liability coverage', {exact: true})).toHaveCount(0);
	});
});

test.describe('mint-general-balance-sheet — lightning disabled', {tag: '@no-lightning'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/');
	});

	test('renders the "Lightning Configuration" button per row in place of the assets value', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const expected_units = mintUnitsFor(config).length;
		const sheet = await openSheet(page);
		await waitForRows(sheet);
		const buttons = sheet.locator('.assets-cell button[mat-stroked-button]');
		await expect(buttons).toHaveCount(expected_units);
		await expect(buttons.first()).toHaveText('Lightning Configuration');
	});

	test('clicking the Lightning Configuration button navigates to /lightning', async ({page}) => {
		const sheet = await openSheet(page);
		await waitForRows(sheet);
		await sheet.locator('.assets-cell button[mat-stroked-button]').first().click();
		await expect(page).toHaveURL(/\/lightning(\/|$)/);
	});
});

test.describe('mint-general-balance-sheet — oracle subcard', {tag: '@oracle'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/');
		await requireReady(page, oracleHasRecentData);
	});

	test('expanded bitcoin row surfaces the Oracle subcard', async ({page}) => {
		// Only runs on cln-nutshell-postgres — `appSettings.bitcoin_oracle: true`
		// + the `compose.mainchain.yml` overlay together let Orchard resolve a
		// real oracle price (staged by `oracle.setup.ts`).
		const sheet = await openSheet(page);
		await waitForRows(sheet);
		const row = bitcoinRow(sheet);
		await row.locator('.balance-sheet-row').click();
		const details = row.locator('.balance-sheet-details');
		await expect(details).toHaveClass(/\banimation-expanded\b/);
		const oracle_card = details.locator('.orc-primary-card');
		await expect(oracle_card).toBeVisible();
		await expect(oracle_card.getByText('Oracle', {exact: true})).toBeVisible();
	});

	test('Oracle subcard Liabilities figure equals price × mint DB sat (USD cents)', async ({page}, testInfo) => {
		// Differential oracle for the converted Liabilities figure inside the
		// Oracle subcard. The component computes `liabilities_oracle` via
		// `oracleConvertToUSDCents(sat_liabilities, price_usd, 'sat')` —
		// `round(sat / 1e8 * price * 100)`. We replicate that with the
		// source-of-truth sat balance from the mint DB and the latest price
		// from Orchard's own DB, then assert against the rendered cents.
		const config = getConfig(testInfo.project.name);
		const sheet = await openSheet(page);
		await waitForRows(sheet);
		const row = bitcoinRow(sheet);
		await row.locator('.balance-sheet-row').click();
		const oracle_card = row.locator('.balance-sheet-details .orc-primary-card');
		await expect(oracle_card).toBeVisible();

		const price = orchard.oraclePrice(config);
		expect(price, 'utxoracle should have a row — readiness gate above should have caught this').not.toBeNull();
		const expected_cents = satToUsdCents(mint.balance(config, 'sat'), price!);

		// Each of the 3 figures in the subcard sits in a `.flex-1` panel with
		// its sublabel underneath; filter to the Liabilities one.
		const lia_panel = oracle_card.locator('.flex-1').filter({hasText: 'Liabilities'});
		const ui_text = await lia_panel.locator('.orc-amount').first().textContent();
		expect(amountFromText(ui_text), 'Oracle subcard Liabilities should equal round(sat * price * 100 / 1e8)').toBe(expected_cents);
	});

	test('Oracle subcard Assets figure equals price × LN local channel balance (USD cents)', async ({page}, testInfo) => {
		// Same conversion as the Liabilities differential, but the source-of-truth
		// sat input comes from the LN node (`ln.localChannelBalance`) instead of
		// the mint DB. The component's `assets_oracle` is computed from the bs
		// row's `assets` (= `lightning_balance.open.local_balance`) via
		// `oracleConvertToUSDCents(assets, price, 'sat')`.
		const config = getConfig(testInfo.project.name);
		const sheet = await openSheet(page);
		await waitForRows(sheet);
		const row = bitcoinRow(sheet);
		await waitForBitcoinAssetsSettled(row);
		await row.locator('.balance-sheet-row').click();
		const oracle_card = row.locator('.balance-sheet-details .orc-primary-card');
		await expect(oracle_card).toBeVisible();

		const price = orchard.oraclePrice(config);
		expect(price, 'utxoracle should have a row — readiness gate above should have caught this').not.toBeNull();
		const expected_cents = satToUsdCents(ln.localChannelBalance(config), price!);

		const assets_panel = oracle_card.locator('.flex-1').filter({hasText: 'Assets'});
		const ui_text = await assets_panel.locator('.orc-amount').first().textContent();
		expect(amountFromText(ui_text), 'Oracle subcard Assets should equal round(ln_local * price * 100 / 1e8)').toBe(expected_cents);
	});

	test('Oracle subcard Fee revenue figure equals price × mint DB sat fees (USD cents)', async ({page}, testInfo) => {
		// Same conversion shape as the other two oracle differentials. Source
		// is the per-unit fees collected by the mint daemon for the sat keyset(s);
		// the component computes `fees_oracle` via
		// `oracleConvertToUSDCents(fees, price, 'sat')`.
		const config = getConfig(testInfo.project.name);
		const sheet = await openSheet(page);
		await waitForRows(sheet);
		const row = bitcoinRow(sheet);
		await row.locator('.balance-sheet-row').click();
		const oracle_card = row.locator('.balance-sheet-details .orc-primary-card');
		await expect(oracle_card).toBeVisible();

		const price = orchard.oraclePrice(config);
		expect(price, 'utxoracle should have a row — readiness gate above should have caught this').not.toBeNull();
		const expected_cents = satToUsdCents(mint.feesPaid(config, 'sat'), price!);

		const fees_panel = oracle_card.locator('.flex-1').filter({hasText: 'Fee revenue'});
		const ui_text = await fees_panel.locator('.orc-amount').first().textContent();
		expect(amountFromText(ui_text), 'Oracle subcard Fee revenue should equal round(sat_fees * price * 100 / 1e8)').toBe(expected_cents);
	});
});
