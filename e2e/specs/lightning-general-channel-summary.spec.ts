/**
 * Feature spec: `orc-lightning-general-channel-summary` — the "Channel Summary"
 * card on the dashboard Lightning row. Groups open + closed channels into one
 * row per asset unit (sats always; one row per Taproot-asset group when tapass
 * is enabled) and toggles between "all open channels" and "only active".
 *
 * Coverage by tag:
 *   - `@lightning`: structure (title, menu trigger label), the sat row's
 *     capacity (differential vs the LN node's `listchannels` capacity sum),
 *     expand/collapse, all four count cards differentially asserted
 *     (Channels, Active, Closed, Average channel size), the "Active channels"
 *     menu toggle that rebuilds the row with the active-only count, and the
 *     no-oracle default branch that hides the oracle subcard.
 *   - `@oracle`: the expanded sat row's Oracle subcard — Total / Local /
 *     Remote capacity USD figures all asserted via `satToUsdCents()` against
 *     the LN node + Orchard's stored oracle price (mirrors the mint balance
 *     sheet's three-figure differential pattern).
 *   - `@tapd`: the second tapass row — structural assertions only; per-asset
 *     capacity differential needs `custom_channel_data` parsing and is left
 *     for a future tapass-focused spec.
 *
 * States the component supports but this spec does NOT cover:
 *   - Inactive-channel divergence between "All" and "Active" modes (regtest
 *     fixture keeps both channels active — exercising the row-rebuild path
 *     is enough to lock the wiring, content divergence is a Karma concern).
 *   - Sat row suppression when both balances are 0 (needs a freshly-opened
 *     channel with zero push_amount before any activity).
 *   - `bitcoin_oracle_enabled === true` racing `bitcoin_oracle_price === null`
 *     (transient — better in Karma).
 *   - Per-asset tapd capacity / local / remote differentials (requires
 *     parsing `custom_channel_data` from `lncli listchannels`).
 */

import {test, expect, type Locator, type Page} from '@playwright/test';

import {getConfig} from '@e2e/helpers/config';
import {ln, orchard} from '@e2e/helpers/backend';
import {oracleHasRecentData, requireReady} from '@e2e/helpers/ui/readiness';

/** Mirror of `oracleConvertToUSDCents(_, _, 'sat')` from the client's oracle
 *  helpers — round(sat / 1e8 × price × 100). Source-of-truth oracle for the
 *  channel summary's three converted figures inside the Oracle subcard.
 *  Same shape as the mint balance sheet's helper. */
function satToUsdCents(sat: number, price: number): number {
	return Math.round((sat / 100_000_000) * price * 100);
}

async function openSummary(page: Page): Promise<Locator> {
	const card = page.locator('orc-lightning-general-channel-summary');
	await expect(card).toBeVisible();
	return card;
}

/** The single sat row. Component emits bitcoin first in both summary modes,
 *  and every regtest fixture has exactly one sat row, so `.first()` is
 *  deterministic. */
function satRow(summary: Locator): Locator {
	return summary.locator('.channel-summary-card').first().locator('mat-card-content').first();
}

/** Strip everything except digits. Handles "2", "2 Channels", "₿ 20,000,000". */
function digitsFrom(text: string): number {
	return parseInt(text.replace(/\D/g, ''), 10);
}

/** Read a count card (one of Channels / Active / Closed / Average) by its
 *  visible label text. The template pluralizes per count — "Channel" when
 *  count === 1 else "Channels" — so pass the plural form and we try both.
 *  Returns the big number above the label. */
async function countCardValue(row: Locator, plural: string): Promise<number> {
	const details = row.locator('.channel-details');
	const singular = plural.replace(/s$/, '');
	const label = details.getByText(plural, {exact: true}).or(details.getByText(singular, {exact: true}));
	const wrapper = label.first().locator('..');
	const value_text = (await wrapper.locator('.font-size-l').first().textContent())?.trim() ?? '';
	return digitsFrom(value_text);
}

test.describe('lightning-general-channel-summary card', {tag: '@lightning'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/');
	});

	test('renders the card with the "Channel Summary" title', async ({page}) => {
		const card = await openSummary(page);
		await expect(card.getByText('Channel Summary', {exact: true})).toBeVisible();
	});

	test('defaults the summary-type menu trigger to "All channels"', async ({page}) => {
		const card = await openSummary(page);
		// The trigger is the only button carrying `aria-haspopup="menu"` inside
		// the card; its visible label reflects `summary_type()` via the ternary
		// in the template.
		const trigger = card.locator('button[aria-haspopup="menu"]');
		await expect(trigger).toHaveText(/All channels/);
	});

	test('renders a sat row labelled "Total sat capacity"', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const card = await openSummary(page);
		// Every regtest fixture funds two sat channels (alice↔orchard,
		// orchard↔far). lnd-cdk-sqlite additionally funds one asset channel,
		// so that config shows a second (tapass) summary-card row.
		const expected_rows = config.tapd ? 2 : 1;
		await expect(card.locator('.channel-summary-card')).toHaveCount(expected_rows);
		await expect(card.getByText('Total sat capacity', {exact: true})).toBeVisible();
	});

	test('sat row glyph uses the btc asset class', async ({page}) => {
		const card = await openSummary(page);
		// `orc-graphic-asset` emits `.graphic-asset-btc` for sat/msat/btc units.
		// Property bindings like `[unit]="row.unit"` do NOT reflect as DOM
		// attributes, so selecting on `[unit="sat"]` would match nothing —
		// same gotcha documented in bitcoin-general-wallet-summary.spec.ts.
		await expect(satRow(card).locator('.graphic-asset-btc').first()).toBeVisible();
	});

	test('sat row capacity matches the sum of LN node sat-only channel capacities', async ({page}, testInfo) => {
		// Differential oracle for the row's collapsed capacity cell. The
		// component's `getSatSummary(false)` reduces non-asset channels'
		// `capacity` into `row.size`; the localAmount pipe wraps the value in
		// glyph/locale formatting. `.orc-amount` is the span the pipe emits —
		// the first match inside the row header is the capacity total
		// (`channel-details` is collapsed and any oracle amount lives inside it
		// anyway).
		const config = getConfig(testInfo.project.name);
		const expected = ln.satChannelCapacity(config);
		const card = await openSummary(page);
		const amount_text = (await satRow(card).locator('.orc-amount').first().textContent())?.trim() ?? '';
		expect(digitsFrom(amount_text), 'sat row capacity should match LN node listchannels capacity sum').toBe(expected);
	});

	test('clicking the sat row toggles expand/collapse classes', async ({page}) => {
		const card = await openSummary(page);
		const row = satRow(card);
		const caret = row.locator('button.orc-animation-rotate-toggle');
		const details = row.locator('.channel-details');

		await expect(caret).not.toHaveClass(/\banimation-expanded\b/);
		await expect(details).not.toHaveClass(/\banimation-expanded\b/);

		await row.click();
		await expect(caret).toHaveClass(/\banimation-expanded\b/);
		await expect(details).toHaveClass(/\banimation-expanded\b/);

		await row.click();
		await expect(caret).not.toHaveClass(/\banimation-expanded\b/);
		await expect(details).not.toHaveClass(/\banimation-expanded\b/);
	});

	test('expanded sat row: Channels count matches sat-only channel count', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const expected = ln.openSatChannelCount(config);

		const card = await openSummary(page);
		const row = satRow(card);
		await row.click();

		expect(await countCardValue(row, 'Channels')).toBe(expected);
	});

	test('expanded sat row: Active count matches active sat-only channel count', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const expected = ln.openSatChannelCount(config, {activeOnly: true});

		const card = await openSummary(page);
		const row = satRow(card);
		await row.click();

		// "Active channels" card is derived from `sat_channels.filter(active)` regardless
		// of summary_type — in the default 'open' mode it still reports the active subset.
		expect(await countCardValue(row, 'Active channels')).toBe(expected);
	});

	test('expanded sat row: Closed count matches LN node closed sat-channel count', async ({page}, testInfo) => {
		// Differential oracle for the Closed channels card. Reads the closed-
		// channel count off the orchard-side LN node (LND: `closedchannels`,
		// CLN: `listclosedchannels`) so a future fixture that closes a channel
		// won't false-fail this — and a regression where `lightningClosedChannels`
		// leaks historical state from a prior Orchard instance still trips.
		const config = getConfig(testInfo.project.name);
		const expected = ln.closedChannelCount(config);

		const card = await openSummary(page);
		const row = satRow(card);
		await row.click();

		expect(await countCardValue(row, 'Closed channels'), 'Closed count should match LN node closed channel list').toBe(expected);
	});

	test('expanded sat row: Average channel size matches round(capacity / count)', async ({page}, testInfo) => {
		// Differential oracle for the Average channel size high-card. The row
		// class computes `Math.round(size / channel_count)`; both inputs flow
		// through helpers we already trust differentially (capacity sum +
		// channel count), so a divergence here points at the rounding step.
		// Skip if the fixture happens to have zero open channels — the
		// component renders 0 in that case and the formula divides by zero.
		const config = getConfig(testInfo.project.name);
		const count = ln.openSatChannelCount(config);
		test.skip(count === 0, 'no open sat channels on this stack — average is rendered as 0 by the row class');
		const expected = Math.round(ln.satChannelCapacity(config) / count);

		const card = await openSummary(page);
		const row = satRow(card);
		await row.click();

		// "Average channel size" label is rendered in the 4th high-card. The
		// value is run through `localAmount` so glyph/locale formatting wraps
		// it — `digitsFrom` recovers the underlying integer the row stores.
		const details = row.locator('.channel-details');
		const avg_card = details.locator('.orc-high-card').filter({hasText: 'Average channel size'});
		const value_text = (await avg_card.locator('.orc-amount').first().textContent())?.trim() ?? '';
		expect(digitsFrom(value_text), 'Average channel size should equal round(total capacity / channel count)').toBe(expected);
	});

	test('toggling the menu to "Active channels" flips the trigger label', async ({page}) => {
		const card = await openSummary(page);
		const trigger = card.locator('button[aria-haspopup="menu"]');

		await trigger.click();
		// The menu renders in the CDK overlay, outside the card — search at the
		// page scope, not inside `card`.
		await page.getByRole('menuitem', {name: /Active channels/}).click();

		await expect(trigger).toHaveText(/Active channels/);
	});

	test('toggling to "Active channels" rebuilds the row with the active-only Channels count', async ({page}, testInfo) => {
		// Locks the wiring between the menu and the rendered row. The row's
		// `Channels` cell switches data sources between `summaries.open[0]`
		// and `summaries.active[0]` — same key, different values. On regtest
		// where every channel is active, this number doesn't actually move,
		// so the assertion is "the active-mode count equals the active SOT
		// from the LN node" rather than "differs from open mode".
		const config = getConfig(testInfo.project.name);
		const expected_active = ln.openSatChannelCount(config, {activeOnly: true});

		const card = await openSummary(page);
		await card.locator('button[aria-haspopup="menu"]').click();
		await page.getByRole('menuitem', {name: /Active channels/}).click();

		const row = satRow(card);
		await row.click();
		expect(await countCardValue(row, 'Channels'), 'Channels count after toggle should reflect active-only mode').toBe(expected_active);
	});

	/* *******************************************************
		Child component: mat-menu (summary-type selector)

		The menu is declared inline in the parent's template but renders via
		MatMenu into the CDK overlay on trigger click. Items are static — two
		always render. The current selection carries `active-summary-option`
		and a `check` mat-icon; the other item has the icon element but no
		glyph text.

		Tests here assert: both items always present,
		selection indicator flips, backdrop-click dismissal is non-mutating.
	******************************************************** */

	test('menu opens with both "All channels" and "Active channels" items', async ({page}) => {
		const card = await openSummary(page);
		await card.locator('button[aria-haspopup="menu"]').click();
		// Both items always render — the current selection is only indicated
		// by class + check icon, not by omission.
		await expect(page.getByRole('menuitem', {name: /All channels/})).toBeVisible();
		await expect(page.getByRole('menuitem', {name: /Active channels/})).toBeVisible();
	});

	test('menu: the currently-selected item carries the active-summary-option class and a check icon', async ({page}) => {
		const card = await openSummary(page);
		await card.locator('button[aria-haspopup="menu"]').click();

		// Default `summary_type === 'open'` → "All channels" is selected.
		const all_item = page.getByRole('menuitem', {name: /All channels/});
		const active_item = page.getByRole('menuitem', {name: /Active channels/});

		await expect(all_item).toHaveClass(/\bactive-summary-option\b/);
		await expect(active_item).not.toHaveClass(/\bactive-summary-option\b/);

		// The `<mat-icon>` inside the selected button renders `check`; the
		// template emits an empty string for the other one, so the icon element
		// exists but has no glyph text.
		await expect(all_item.locator('mat-icon')).toHaveText('check');
		await expect(active_item.locator('mat-icon')).toHaveText('');
	});

	test('menu: selection indicator swaps after clicking "Active channels"', async ({page}) => {
		const card = await openSummary(page);
		await card.locator('button[aria-haspopup="menu"]').click();
		await page.getByRole('menuitem', {name: /Active channels/}).click();

		// Re-open the menu and verify the check/highlight moved to the Active item.
		await card.locator('button[aria-haspopup="menu"]').click();
		const all_item = page.getByRole('menuitem', {name: /All channels/});
		const active_item = page.getByRole('menuitem', {name: /Active channels/});

		await expect(active_item).toHaveClass(/\bactive-summary-option\b/);
		await expect(all_item).not.toHaveClass(/\bactive-summary-option\b/);
		await expect(active_item.locator('mat-icon')).toHaveText('check');
		await expect(all_item.locator('mat-icon')).toHaveText('');
	});

	test('menu: clicking backdrop closes without mutating summary_type', async ({page}) => {
		const card = await openSummary(page);
		const trigger = card.locator('button[aria-haspopup="menu"]');
		await trigger.click();

		// MatMenu uses a transparent CDK backdrop; pressing Escape is the
		// portable dismissal that works regardless of backdrop hit-testing.
		await expect(page.getByRole('menuitem', {name: /All channels/})).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.getByRole('menuitem', {name: /All channels/})).toHaveCount(0);

		// Label stayed at the default "All channels" — no mutation.
		await expect(trigger).toHaveText(/All channels/);
	});

	/* *******************************************************
		Child component: orc-lightning-general-channel (flow graphic)

		Presentational — no interactions. Renders one instance per row.
		The sat row applies `channel-btc` (orange/red split); the TESTASSET
		row applies `channel-unknown` (no registered group_key → neutral).
	******************************************************** */

	test('sat row flow graphic carries the channel-btc class (unit === sat)', async ({page}) => {
		const card = await openSummary(page);
		const row = satRow(card);
		// `channel_class` computed emits `channel-btc` for sat/msat/btc. Class
		// binding is on a child of `orc-lightning-general-channel`, not the
		// host — the component's template roots an element with this class.
		await expect(row.locator('orc-lightning-general-channel .channel-btc').first()).toBeVisible();
	});

	test('oracle card is not rendered when the bitcoin oracle is off (default)', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		test.skip(config.appSettings?.bitcoin_oracle === true, 'oracle is on for this stack — the off-default branch is unreachable here');
		const card = await openSummary(page);
		const row = satRow(card);
		await row.click();

		await expect(row.locator('orc-graphic-oracle-icon')).toHaveCount(0);
		await expect(row.getByText('Oracle', {exact: true})).toHaveCount(0);
	});
});

test.describe('lightning-general-channel-summary card — oracle subcard', {tag: '@oracle'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/');
		await requireReady(page, oracleHasRecentData);
	});

	/** Each of the 3 figures in the oracle subcard sits in a `.flex-1` panel
	 *  with its sublabel underneath; this filters to the right one. The oracle
	 *  card is an `orc-primary-card` inside `.channel-details`. */
	function oraclePanel(row: Locator, sublabel: string): Locator {
		return row.locator('.channel-details .orc-primary-card .flex-1').filter({hasText: sublabel});
	}

	test('expanded sat row surfaces the Oracle subcard', async ({page}) => {
		// Only runs on cln-nutshell-postgres — `appSettings.bitcoin_oracle: true`
		// + the `compose.mainchain.yml` overlay together let Orchard resolve a
		// real oracle price (staged by `oracle.setup.ts`).
		const card = await openSummary(page);
		const row = satRow(card);
		await row.click();
		const oracle_card = row.locator('.channel-details .orc-primary-card');
		await expect(oracle_card).toBeVisible();
		await expect(oracle_card.getByText('Oracle', {exact: true})).toBeVisible();
	});

	test('Oracle subcard Total capacity figure equals price × LN sat capacity (USD cents)', async ({page}, testInfo) => {
		// Differential oracle for `row.size_oracle` — `oracleConvertToUSDCents(size,
		// price, 'sat')` → `round(sat / 1e8 * price * 100)`. Source-of-truth sat
		// input is the LN node's non-asset channel capacity sum; price is read
		// from Orchard's own utxoracle table.
		const config = getConfig(testInfo.project.name);
		const card = await openSummary(page);
		const row = satRow(card);
		await row.click();

		const price = orchard.oraclePrice(config);
		expect(price, 'utxoracle should have a row — readiness gate above should have caught this').not.toBeNull();
		const expected_cents = satToUsdCents(ln.satChannelCapacity(config), price!);

		const ui_text = await oraclePanel(row, 'Total capacity').locator('.orc-amount').first().textContent();
		expect(digitsFrom(ui_text ?? ''), 'Oracle Total capacity should equal round(capacity * price * 100 / 1e8)').toBe(expected_cents);
	});

	test('Oracle subcard Local capacity figure equals price × LN local channel balance (USD cents)', async ({page}, testInfo) => {
		// Differential oracle for `row.local_oracle`. Source-of-truth sat input
		// is the LN node's per-channel local_balance sum (non-asset channels),
		// already exercised by the mint balance sheet's bitcoin-row assets cell.
		const config = getConfig(testInfo.project.name);
		const card = await openSummary(page);
		const row = satRow(card);
		await row.click();

		const price = orchard.oraclePrice(config);
		expect(price, 'utxoracle should have a row — readiness gate above should have caught this').not.toBeNull();
		const expected_cents = satToUsdCents(ln.localChannelBalance(config), price!);

		const ui_text = await oraclePanel(row, 'Local capacity').locator('.orc-amount').first().textContent();
		expect(digitsFrom(ui_text ?? ''), 'Oracle Local capacity should equal round(local * price * 100 / 1e8)').toBe(expected_cents);
	});

	test('Oracle subcard Remote capacity figure equals price × LN remote channel balance (USD cents)', async ({page}, testInfo) => {
		// Differential oracle for `row.remote_oracle`. Mirror of the local-cap
		// assertion above — sums each non-asset channel's `remote_balance`.
		const config = getConfig(testInfo.project.name);
		const card = await openSummary(page);
		const row = satRow(card);
		await row.click();

		const price = orchard.oraclePrice(config);
		expect(price, 'utxoracle should have a row — readiness gate above should have caught this').not.toBeNull();
		const expected_cents = satToUsdCents(ln.remoteChannelBalance(config), price!);

		const ui_text = await oraclePanel(row, 'Remote capacity').locator('.orc-amount').first().textContent();
		expect(digitsFrom(ui_text ?? ''), 'Oracle Remote capacity should equal round(remote * price * 100 / 1e8)').toBe(expected_cents);
	});
});

/** Taproot-asset row. Only reachable on `lnd-cdk-sqlite` where `fund-tapd.sh`
 *  + `fund-tapass-channel.sh` mint TESTASSET and open exactly one asset-backed
 *  LN channel between orchard↔alice. Asserts the component's *second* summary
 *  row exists, renders the asset unit, and counts exactly one channel. */
test.describe('lightning-general-channel-summary card — taproot asset row', {tag: '@tapd'}, () => {
	// Seeded by fund-tapd.sh (amount=100000, decimal_display=2, grouped) and
	// fund-tapass-channel.sh (commits 500 TESTASSET to the channel). Keep in
	// sync with those scripts.
	const TEST_ASSET = 'TESTASSET';

	/** Second `.channel-summary-card` — component emits bitcoin first, tapass
	 *  rows after (one per group_key). The fixture only mints one asset, so
	 *  index 1 is the TESTASSET row. */
	function tapassRow(summary: Locator): Locator {
		return summary.locator('.channel-summary-card').nth(1).locator('mat-card-content').first();
	}

	test.beforeEach(async ({page}) => {
		await page.goto('/');
	});

	test('renders a second row labelled "Total TESTASSET capacity"', async ({page}) => {
		const card = await openSummary(page);
		await expect(card.locator('.channel-summary-card')).toHaveCount(2);
		// Template: `Total {{ row.unit === 'msat' ? 'bitcoin' : row.unit }} capacity`
		// → tapass row uses the asset name as the unit.
		await expect(card.getByText(`Total ${TEST_ASSET} capacity`, {exact: true})).toBeVisible();
	});

	test('tapass row glyph uses the asset-unknown class (no registered svg for TESTASSET)', async ({page}) => {
		const card = await openSummary(page);
		// TESTASSET isn't in `constants.taproot_group_keys`, so `orc-graphic-asset`
		// falls through to the `.graphic-asset-unknown` class (same behaviour
		// documented in bitcoin-general-wallet-summary.spec.ts).
		await expect(tapassRow(card).locator('.graphic-asset-unknown').first()).toBeVisible();
	});

	test('tapass row capacity renders a non-zero amount', async ({page}) => {
		const card = await openSummary(page);
		const amount_text = (await tapassRow(card).locator('.orc-amount').first().textContent())?.trim() ?? '';
		// fund-tapass-channel.sh commits 500 TESTASSET; decimal_display=2 → '5.00'.
		// Assert >0 rather than exact so a future script tweak (different amount
		// or decimals) doesn't break this — the fidelity we care about is that
		// asset data flowed lnd → orchard → UI at all.
		expect(digitsFrom(amount_text)).toBeGreaterThan(0);
	});

	test('clicking the tapass row toggles expand/collapse classes', async ({page}) => {
		const card = await openSummary(page);
		const row = tapassRow(card);
		const caret = row.locator('button.orc-animation-rotate-toggle');
		const details = row.locator('.channel-details');

		await expect(caret).not.toHaveClass(/\banimation-expanded\b/);
		await row.click();
		await expect(caret).toHaveClass(/\banimation-expanded\b/);
		await expect(details).toHaveClass(/\banimation-expanded\b/);
	});

	test('expanded tapass row counts match the asset-channel fixture', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		// Differential: count the orchard node's real asset channels via lnd's
		// custom_channel_data rather than hard-coding 1 — protects against a
		// future fixture that opens a second asset channel.
		const asset_count = ln.assetChannelCount(config);
		const asset_active_count = ln.assetChannelCount(config, 'orchard', {activeOnly: true});

		const card = await openSummary(page);
		const row = tapassRow(card);
		await row.click();

		expect(await countCardValue(row, 'Channels')).toBe(asset_count);
		expect(await countCardValue(row, 'Active channels')).toBe(asset_active_count);
		expect(await countCardValue(row, 'Closed channels')).toBe(0);
	});

	test('tapass row has no oracle card (oracle only applies to sat rows)', async ({page}) => {
		// Template gate: `@if (row.is_bitcoin && bitcoin_oracle_enabled())`.
		// `is_bitcoin` is false for tapass rows, so even with the oracle on
		// this section must not render. On regtest the oracle is also off.
		const card = await openSummary(page);
		const row = tapassRow(card);
		await row.click();

		await expect(row.locator('orc-graphic-oracle-icon')).toHaveCount(0);
	});
});
