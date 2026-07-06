/**
 * Feature spec: the `/mint/database` QUOTE TABLES — the Mints / Melts / Swaps
 * data views of `orc-mint-subsection-database` (the existing
 * mint-subsection-database.spec.ts covers backup/restore/structure and
 * deliberately skips these tables; this file is that gap).
 *
 * The differential: the page loads one table type at a time over a
 * genesis→today window (`getPageSettings()` defaults: type=Mints,
 * date_start = min keyset valid_from, date_end = end of today) and renders
 * the UNPAGED total in the mat-paginator range label. Each assertion pivots
 * on the mint daemon's own database via `mint.quoteCount` / `mint.swapCount`
 * (helpers/backend/mint.ts), which mirror the count resolvers
 * (`countMintQuotes` / `countMeltQuotes` / `countSwaps`):
 *
 *   UI paginator total  ==  SELECT COUNT(*) FROM <mint db> windowed the same way
 *
 * The Request column renders an `orc-mint-general-payment-method` chip per
 * row (BOLT 11 / BOLT 12 / ONCHAIN) from the quote's `payment_method` column,
 * so the chip distribution is asserted against per-method DB counts — this is
 * the first spec that exercises non-bolt11 quote rendering. Sim coverage:
 * cln-cdk-postgres carries all three methods, lnd-cdk-sqlite carries
 * bolt11+onchain, fake-cdk-postgres all three (fake_wallet auto-settles),
 * nutshell stacks are bolt11-only (no payment_method column; Orchard
 * hardcodes 'bolt11') — the per-method differential therefore asserts ZERO
 * bolt12/onchain chips on nutshell rather than skipping.
 *
 * Cleanup / suite-green: the type switch persists to device settings
 * (localStorage `v1.mint.database.settings`) — never the DB — so each test
 * clears that key in afterEach and reruns are drift-proof: counts are read
 * from the DB at assert time, not hard-coded.
 *
 * KNOWN DRIFT (nutshell only, UPSTREAM bug): nutshell's crud.py
 * `update_keyset` rewrites valid_from/first_seen to "now" on any keyset
 * update — rotation deactivation included — so every keysets-rotation spec
 * run drags min(valid_from) — the page's genesis — forward past the
 * historical quotes, and the default window legitimately shows 0 of 0.
 * The paginator/chip differentials still hold at zero (UI mirrors the
 * resolver either way); the row-dependent tests skip when the window is
 * empty. Remove those guards once the nutshell fix ships in the e2e image.
 *
 * States deliberately NOT covered:
 *   - Unit / state checkbox filters + date-range edits (`unit-better` — same
 *     buildDynamicQuery path the paginator differential already proves; the
 *     date-picker is locale-sensitive and belongs to form specs).
 *   - "Set as Paid" action + dialog (mutates quote state — covered by the
 *     UNPAID-quote flows in the cadence sim, and too sharp to flip here).
 *   - The chart canvas (presence-only per house convention, already covered
 *     by the structural spec).
 */

import {test, expect, type Page} from '@playwright/test';
import {DateTime} from 'luxon';

import {getConfig} from '@e2e/helpers/config';
import {mint} from '@e2e/helpers/backend';
import type {ConfigInfo} from '@e2e/types/config';

/** localStorage key the page persists its type/window/filters into
 *  (`LocalStorageService.STORAGE_KEYS.MINT_DATABASE_KEY`). Cleared after each
 *  test so the next mount starts from the default Mints/genesis window. */
const MINT_DATABASE_KEY = 'v1.mint.database.settings';

/** Mirror of the component's default window: `getMintGenesisTime()` (min
 *  keyset `valid_from`) → `getDefaultDateEnd()` (end of today in the device
 *  timezone that settings.setup seeded). Both sides of the differential
 *  derive the window identically, and no quote can predate its keyset or
 *  postdate "now", so boundary skew cannot flip a count. */
function defaultWindow(config: ConfigInfo): {date_start: number; date_end: number} {
	const valid_times = mint
		.keysets(config)
		.map((keyset) => keyset.valid_from)
		.filter((t): t is number => t != null);
	const zone = config.deviceSettings?.timezone ?? 'local';
	return {
		date_start: valid_times.length > 0 ? Math.min(...valid_times) : 0,
		date_end: Math.floor(DateTime.now().setZone(zone).endOf('day').toSeconds()),
	};
}

/** Total from the paginator's range label ("1 – 15 of 15" → 15) — the only
 *  place the page renders the UNPAGED total, directly comparable to a SQL
 *  COUNT of the same predicate. */
async function paginatorTotal(page: Page): Promise<number> {
	const label = (await page.locator('.mat-mdc-paginator-range-label').textContent()) ?? '';
	const m = label.match(/of\s+(\d+)/);
	expect(m, `paginator range label should match "x – y of N" (got "${label}")`).not.toBeNull();
	return parseInt(m![1], 10);
}

/** Wait for the page to have loaded its current data type. The neutral
 *  `table` placeholder icon renders while `loading()` is true or the source
 *  is empty-null; the paginator label reads real totals once the first
 *  response lands. */
async function settle(page: Page): Promise<void> {
	await expect(page.locator('orc-mint-subsection-database-control')).toBeVisible();
	await expect(page.locator('.mat-mdc-paginator-range-label')).toHaveText(/of\s+\d+/, {timeout: 20_000});
}

/** Switch the Data select to another type (labels: Mints / Melts / Swaps).
 *  Callers assert the resulting paginator total via expect.poll, which
 *  doubles as the wait for the reload triggered by `onTypeChange`. */
async function switchType(page: Page, label: 'Mints' | 'Melts' | 'Swaps'): Promise<void> {
	// Retry the whole open-and-pick: under full-matrix load the trigger click
	// can land while the page is mid-hydration and the panel never opens (the
	// option wait then starves) — re-clicking the trigger recovers.
	await expect(async () => {
		await page.locator('orc-mint-subsection-database-control mat-select').click();
		// mat-option only exists while the panel is open — no container
		// qualifier (the panel is NOT under `.cdk-overlay-container` in this
		// Material build; same bare pattern as helpers/ui/settings.ts
		// `applyAiModel`). Native DOM click: the select panel repositions
		// while the table behind it swaps between loading/loaded, so
		// Playwright's stability gate can starve on slower stacks — same
		// escape hatch the ai-job spec uses for its menu.
		const option = page.locator('mat-option .option-main', {hasText: new RegExp(`^${label}$`)});
		await expect(option).toBeVisible({timeout: 2_000});
		await option.evaluate((el) => (el as HTMLElement).click());
	}).toPass({timeout: 20_000});
}

/** Count visible payment-method chips with an exact label. The chip's inner
 *  `.text-nowrap` div holds exactly "BOLT 11" / "BOLT 12" / "ONCHAIN" (the
 *  sibling mat-icon ligature text lives outside it), so an anchored regex is
 *  collision-safe ("BOLT 11" vs "BOLT 12"). */
function methodChips(page: Page, label: 'BOLT 11' | 'BOLT 12' | 'ONCHAIN') {
	return page.locator('orc-mint-subsection-database-table orc-mint-general-payment-method .text-nowrap', {
		hasText: new RegExp(`^${label}$`),
	});
}

test.describe('mint-subsection-database — quote tables differential', {tag: '@mint'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/mint/database', {waitUntil: 'networkidle'});
		await settle(page);
	});

	test.afterEach(async ({page}) => {
		// The type switch persists to device settings — drop the key so the
		// next mount (this storageState, any spec) starts from the default
		// Mints view over the genesis window.
		await page.evaluate((key) => localStorage.removeItem(key), MINT_DATABASE_KEY);
	});

	test('Mints paginator total matches the mint DB quote count over the genesis window', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const window = defaultWindow(config);

		// No >0 precondition: on nutshell the genesis window can be legitimately
		// empty after a keyset rotation (valid_from drift — see header). The
		// differential holds at any count, zero included.
		const db_count = mint.quoteCount(config, {kind: 'mint', ...window});

		await expect
			.poll(() => paginatorTotal(page), {message: `paginator should equal DB mint_quote count (${db_count})`})
			.toBe(db_count);

		// Page 1 renders one entity row per quote up to the page size (100
		// default — every e2e stack is far below it, so rows == total).
		expect(db_count, 'stacks should fit on one page for the row-count check').toBeLessThanOrEqual(100);
		await expect(page.locator('orc-mint-subsection-database-table tr.entity-row')).toHaveCount(db_count);
	});

	test('switching to Melts and Swaps re-derives the paginator from the matching mint DB tables', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const window = defaultWindow(config);

		const melt_count = mint.quoteCount(config, {kind: 'melt', ...window});
		await switchType(page, 'Melts');
		await expect
			.poll(() => paginatorTotal(page), {message: `paginator should equal DB melt_quote count (${melt_count})`, timeout: 15_000})
			.toBe(melt_count);

		const swap_count = mint.swapCount(config, window);
		await switchType(page, 'Swaps');
		await expect
			.poll(() => paginatorTotal(page), {message: `paginator should equal DB swap count (${swap_count})`, timeout: 15_000})
			.toBe(swap_count);

		// Round-trip back to Mints so the in-page state matches what afterEach
		// resets localStorage to.
		const mint_count = mint.quoteCount(config, {kind: 'mint', ...window});
		await switchType(page, 'Mints');
		await expect.poll(() => paginatorTotal(page), {timeout: 15_000}).toBe(mint_count);
	});

	test('payment-method chip distribution matches the DB payment_method column (both quote tables)', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const window = defaultWindow(config);

		for (const kind of ['mint', 'melt'] as const) {
			if (kind === 'melt') {
				const melt_total = mint.quoteCount(config, {kind: 'melt', ...window});
				await switchType(page, 'Melts');
				await expect.poll(() => paginatorTotal(page), {timeout: 15_000}).toBe(melt_total);
			}
			const total = mint.quoteCount(config, {kind, ...window});
			expect(total, 'per-method chip counting requires all rows on one page').toBeLessThanOrEqual(100);

			// On nutshell stacks the bolt12/onchain DB counts are 0 by
			// construction (no payment_method column, wire value hardcoded
			// bolt11) — the assertions below then prove ZERO such chips render.
			const expected = {
				'BOLT 11': mint.quoteCount(config, {kind, ...window, payment_method: 'bolt11'}),
				'BOLT 12': mint.quoteCount(config, {kind, ...window, payment_method: 'bolt12'}),
				ONCHAIN: mint.quoteCount(config, {kind, ...window, payment_method: 'onchain'}),
			} as const;
			expect(
				expected['BOLT 11'] + expected['BOLT 12'] + expected.ONCHAIN,
				`${kind} per-method counts should partition the total (${total})`,
			).toBe(total);

			for (const [label, count] of Object.entries(expected)) {
				await expect(
					methodChips(page, label as 'BOLT 11' | 'BOLT 12' | 'ONCHAIN'),
					`${kind} table should render ${count} "${label}" chips`,
				).toHaveCount(count);
			}
		}
	});

	test('expanding a mint-quote row surfaces the DB row: quote id exists and its method matches the row chip', async ({
		page,
	}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const window = defaultWindow(config);
		test.skip(
			mint.quoteCount(config, {kind: 'mint', ...window}) === 0,
			'default window is empty — nutshell genesis drift after rotation (upstream update_keyset bug)',
		);

		const first_row = page.locator('orc-mint-subsection-database-table tr.entity-row').first();
		await first_row.click();

		const detail = page.locator('orc-mint-subsection-database-table-mint');
		await expect(detail).toBeVisible();

		// First mega-string in the detail is the Mint Quote ID (the second is
		// the payment request).
		const quote_id = ((await detail.locator('.mega-string').first().textContent()) ?? '').trim();
		expect(quote_id.length, 'detail should render a non-empty quote id').toBeGreaterThan(0);

		const db_row = mint.quoteById(config, 'mint', quote_id);
		expect(db_row, `quote id "${quote_id}" from the UI should exist in the mint DB`).not.toBeNull();

		const chip = ((await first_row.locator('orc-mint-general-payment-method .text-nowrap').textContent()) ?? '').trim();
		expect(chip.replace(/\s+/g, '').toLowerCase(), 'row chip should match the DB payment_method').toBe(db_row!.payment_method);
	});

	test('bolt12/onchain rows render the reusable amounts sub-card in their detail; bolt11 rows do not', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const window = defaultWindow(config);
		const non_bolt11 =
			mint.quoteCount(config, {kind: 'mint', ...window, payment_method: 'bolt12'}) +
			mint.quoteCount(config, {kind: 'mint', ...window, payment_method: 'onchain'});
		test.skip(non_bolt11 === 0, 'no bolt12/onchain mint quotes on this stack (nutshell is bolt11-only)');

		// A non-bolt11 row: the template mounts the reusable card iff
		// payment_method ∈ {bolt12, onchain}.
		const special_row = page
			.locator('orc-mint-subsection-database-table tr.entity-row')
			.filter({has: page.locator('orc-mint-general-payment-method .text-nowrap', {hasText: /^(BOLT 12|ONCHAIN)$/})})
			.first();
		await special_row.click();
		await expect(page.locator('orc-mint-subsection-database-table-mint-reusable')).toBeVisible();

		// Collapse, then expand a bolt11 row — no reusable card.
		await special_row.click();
		const bolt11_row = page
			.locator('orc-mint-subsection-database-table tr.entity-row')
			.filter({has: page.locator('orc-mint-general-payment-method .text-nowrap', {hasText: /^BOLT 11$/})})
			.first();
		await bolt11_row.click();
		await expect(page.locator('orc-mint-subsection-database-table-mint')).toBeVisible();
		await expect(page.locator('orc-mint-subsection-database-table-mint-reusable')).toHaveCount(0);
	});
});
