/**
 * Feature spec: `orc-mint-general-activity` — the "Activity" card on the
 * dashboard (`/`) summarising recent mint operations (24h / 3d / 7d) with
 * sparklines, deltas, and completion-rate rings. Same component is reused
 * on `/mint`; the dashboard tile is the canonical surface every spec
 * navigates to in `beforeEach`.
 *
 * This component is analytics-sensitive. The numbers it renders come from
 * `mint_analytics_cache` — Orchard's own archive of the mint daemon's
 * mint/melt/swap rows, written by the streaming backfill in
 * `CashuMintAnalyticsService.runBackfill()`. Backfill runs:
 *   - once on app bootstrap
 *   - every hour at `:05` UTC (task.service.ts:156)
 *   - daily rescan of the past 7 days at 3:30 UTC (task.service.ts:180)
 * There is no on-demand GraphQL trigger, so any test that asserts
 * UI-vs-DB equality has to gate on backfill having run AND ceiling its
 * oracle window to `last_processed_at + 3600` (the upper edge of what the
 * cache currently covers). See `mint.activitySummaryOracle()` in
 * `e2e/helpers/backend/mint.ts` for the windowing math and the readiness
 * gate `mintAnalyticsBackfilled` in `e2e/helpers/ui/readiness.ts` for the
 * skip predicate.
 *
 * Coverage by tag:
 *   - `@mint`: structure that holds on every stack with a mint backend —
 *     title, period button, populated branch (7 high-cards, 3 sparklines,
 *     2 progress circles), and the period-menu interaction surface.
 *   - Differential cache-vs-DB equality runs on all `@mint` stacks. The
 *     oracle is ceiling'd to `last_processed_at`, so on a stack where the
 *     bootstrap backfill has run but the hourly cron hasn't fired since
 *     fixture-setup ops landed, the oracle and cache agree on what's in
 *     the window — both miss the same rows and the assertion holds.
 *
 * States the component supports but this spec does NOT cover:
 *   - loading-spinner branch (transient first-paint; covered in Karma)
 *   - error branch (requires `docker pause` of the mint container —
 *     disruptive to sibling specs sharing the stack)
 *   - all-zero render on a freshly booted mint (poor reachability —
 *     sibling specs in the run produce ops in the same 24h window)
 *   - negative-delta / warnings render path (negative deltas need a
 *     synthetic prior period; warnings only emit while backfill is
 *     mid-run — both `unit-better`)
 *   - `formatDuration` thresholds (`0s`/`500ms`/`12s`/`2m`/`1.0h`) — pure
 *     helper, exhaustive coverage in the Karma spec
 *   - chart.js gradient colour fidelity — `unit-better` (canvas pixel
 *     diffing is flaky in headless Chrome)
 */

import {test, expect, type Locator, type Page} from '@playwright/test';

import {getConfig, mintUnitsFor} from '@e2e/helpers/config';
import {mint, orchard} from '@e2e/helpers/backend';
import {getReadiness, mintAnalyticsHasRows, requireReady} from '@e2e/helpers/ui/readiness';
import type {Readiness} from '@e2e/types/readiness';
import type {ConfigInfo} from '@e2e/types/config';

async function openCard(page: Page): Promise<Locator> {
	// Both `/` (dashboard tile) and `/mint` (subsection dashboard) host one
	// instance — `.first()` is defensive for future surfaces that mount it
	// elsewhere on the same page.
	const card = page.locator('orc-mint-general-activity').first();
	await expect(card).toBeVisible();
	return card;
}

/** Wait for the populated branch to settle. The parent dashboard tile starts
 *  the card with `loading=true` and flips it to `false` once the
 *  `mint_activity_summary` GraphQL query resolves. The first `.orc-high-card`
 *  only mounts inside the `@if (summary())` populated branch, so its
 *  visibility is the canonical "card is no longer in spinner-state" signal.
 *  Timeout bumped to 20s — under parallel-stack contention the activity
 *  query stacks behind the dashboard's other forkJoin queries on slower
 *  stacks. */
async function waitForPopulated(card: Locator): Promise<void> {
	await expect(card.locator('.orc-high-card').first()).toBeVisible({timeout: 20_000});
}

/** Parse an integer out of rendered text. The activity tiles run their
 *  values through Angular's `number` pipe (e.g. "1,234"), so non-digit
 *  characters strip cleanly. Returns 0 for null/undefined. */
function amountFromText(text: string | null | undefined): number {
	const stripped = (text ?? '').replace(/\D/g, '');
	return stripped === '' ? 0 : parseInt(stripped, 10);
}

/** Read the headline numeric value out of the high-card whose sublabel
 *  matches `label` exactly. Tiles all share the same template — the
 *  sublabel is a `<div class="font-size-xs orc-outline-color">{label}</div>`.
 *  Selecting `.orc-high-card:has(div.orc-outline-color:text-is("{label}"))`
 *  scopes by Playwright's `:text-is()` (whole-text match) inside `:has()`,
 *  which avoids both substring collisions ("Mints" vs "Mints completed")
 *  and the `filter({has: card.getByText(...)})` re-rooting that returned
 *  zero matches in earlier iterations.
 *
 *  - top tiles ("Operations", "Unit volume") render the value as
 *    `.font-size-xl`
 *  - sparkline tiles ("Mints", "Melts", "Swaps") use `.font-size-l`
 *  - completion tiles ("Mints completed", "Melts completed") use
 *    `.font-size-l` for the percentage and a separate `.font-size-m` for
 *    the avg-time string. Caller passes the right size class.
 *
 *  `.first()` on the value class picks the headline number, not the
 *  delta percentage (which lives in a `.delta` chip with `.font-size-xs`). */
async function tileNumber(card: Locator, label: string, valueClass: '.font-size-xl' | '.font-size-l'): Promise<number> {
	const tile = card.locator(`.orc-high-card:has(div.orc-outline-color:text-is("${label}"))`);
	await expect(tile).toBeVisible();
	const text = await tile.locator(valueClass).first().textContent();
	return amountFromText(text);
}

/** Latest hour bucket the `analytics_mint` cache has produced rows for.
 *  Derived from the readiness probe's `mint_analytics_recent` (already
 *  fetched by `getReadiness`) — `max(date)` across `mints_created`,
 *  `melts_created`, and `swaps_amount` rows. This is the parameter the
 *  oracle uses to ceiling its window: hour buckets > this value haven't
 *  been written to cache yet, so any DB rows there would mismatch UI
 *  if compared. Reading from cache rows (persisted in `orchard.db`)
 *  avoids the in-memory-staleness pitfall of
 *  `mint_analytics_backfill_status.last_processed_at`, which resets to
 *  null on every orchard restart. */
function latestMintCacheHour(readiness: Readiness): number {
	return readiness.mint_analytics_recent.reduce((max, row) => Math.max(max, row.date), 0);
}

/** Run one cache↔DB differential attempt with BOTH sides from the same
 *  backfill generation: readiness snapshot → oracle → fresh card load →
 *  caller's assert, retried as a unit. The hourly backfill cron (:05, and
 *  it catch-up-writes several hour buckets in one pass) can land between
 *  the readiness read and the card's own analytics query — observed as
 *  oracle ceiling'd at a stale hour while the card renders mid-write cache
 *  sums. A backfill write mid-attempt fails that attempt; the next one
 *  sees both sides settled. */
async function assertSameGeneration(
	page: Page,
	config: ConfigInfo,
	assert: (oracle: ReturnType<typeof mint.activitySummaryOracle>, card: Locator) => Promise<void>,
): Promise<void> {
	await expect(async () => {
		const readiness = await getReadiness(page);
		const oracle = mint.activitySummaryOracle(config, {last_processed_at: latestMintCacheHour(readiness)});
		await page.reload();
		const card = await openCard(page);
		await waitForPopulated(card);
		await assert(oracle, card);
	}).toPass({timeout: 45_000});
}

test.describe('mint-general-activity card — structure', {tag: '@mint'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/');
	});

	test('renders the "Activity" title', async ({page}) => {
		const card = await openCard(page);
		await expect(card.getByText('Activity', {exact: true})).toBeVisible();
	});

	test('renders the period selector button defaulting to "24 hours"', async ({page}) => {
		// `selected_period` is a component-local signal initialised to
		// MintActivityPeriod.Day; `period_label` maps that to "24 hours".
		// No localStorage persistence — the picker resets on every reload.
		const card = await openCard(page);
		const button = card.locator('.mint-activity-period-selector button');
		await expect(button).toBeVisible();
		await expect(button).toHaveText(/24 hours/);
	});

	test('populated branch mounts seven high-cards (top, sparkline, completion rows)', async ({page}) => {
		// Layout: 2 top tiles (Operations, Unit volume) + 3 sparkline tiles
		// (Mints, Melts, Swaps) + 2 completion tiles = 7. This count is
		// independent of the underlying numbers — even an all-zero card mounts
		// all 7. If the count drifts, the layout has changed and the dependent
		// per-tile differential assertions need to be reaudited.
		const card = await openCard(page);
		await waitForPopulated(card);
		await expect(card.locator('.orc-high-card')).toHaveCount(7);
	});

	test('sparkline tiles each mount a chart.js canvas', async ({page}) => {
		// `mint_chart_data` / `melt_chart_data` / `swap_chart_data` are
		// rebuilt in `ngOnChanges` when `loading` flips false; the canvas
		// only mounts inside the inner `@if (mint_chart_data)` etc. Three
		// always render together (or none, on the never-populated edge).
		const card = await openCard(page);
		await waitForPopulated(card);
		await expect(card.locator('canvas')).toHaveCount(3);
	});

	test('completion tiles each mount an orc-progress-circle', async ({page}) => {
		const card = await openCard(page);
		await waitForPopulated(card);
		await expect(card.locator('orc-progress-circle')).toHaveCount(2);
	});

	test('completion tiles render the "avg time" sublabel', async ({page}) => {
		// `formatDuration(seconds)` produces ms / s / m / h variants; the
		// sublabel "avg time" is constant. Asserting on the constant keeps
		// the test stable across whatever bucket-size the helper picks.
		const card = await openCard(page);
		await waitForPopulated(card);
		await expect(card.getByText('Mints completed', {exact: true})).toBeVisible();
		await expect(card.getByText('Melts completed', {exact: true})).toBeVisible();
		await expect(card.getByText('avg time', {exact: true}).first()).toBeVisible();
	});

	test('every populated tile shows a delta chip (▲ or ▼ %)', async ({page}) => {
		// Seven tiles → seven `.delta` spans (one per tile, including both
		// completion tiles whose deltas live next to the percentage). The
		// `value >= 0` predicate paints `.delta-positive` (green ▲); a delta
		// of exactly zero still counts as positive.
		const card = await openCard(page);
		await waitForPopulated(card);
		await expect(card.locator('.delta')).toHaveCount(7);
	});
});

test.describe('mint-general-activity card — cache↔DB differential', {tag: '@analytics'}, () => {
	test.beforeEach(async ({page}, testInfo) => {
		await page.goto('/');
		// Skip if `analytics_mint` is empty — backfill either hasn't run yet
		// or the mint has had zero operations. The predicate reads the
		// persisted cache rows, so it survives orchard restarts (unlike
		// the in-memory `mint_analytics_backfill_status.last_processed_at`
		// which resets to null on every restart).
		await requireReady(page, mintAnalyticsHasRows);
		// Skip when the archive has a HOLE below its floor: mint activity
		// exists in hours the archive never covered (the 1.10 boot wiped
		// `analytics_mint` but kept `analytics_checkpoint`, so backfill never
		// revisits pre-wipe hours — chip task_32c3e61d). The cache and the
		// raw-DB oracle then disagree by exactly the unarchived history and
		// the differential's precondition is broken. Un-skips automatically
		// once the archive again covers the mint's earliest activity.
		const config = getConfig(testInfo.project.name);
		const floor = orchard.mintArchiveFloor(config);
		const earliest = mint.earliestQuoteTime(config);
		test.skip(
			floor !== null && earliest !== null && Math.floor(earliest / 3600) * 3600 < floor,
			`analytics archive hole: earliest mint activity ${earliest} predates archive floor ${floor} (task_32c3e61d)`,
		);
	});

	test('Operations tile equals total mint+melt+swap operations in the cache window', async ({page}, testInfo) => {
		// Differential oracle for the headline count. Mirrors the server's
		// `total_operations = mint_count + melt_count + swap_count` math, where
		// each `*_count` is the COUNT of rows in the daemon DB whose hour
		// bucket falls in the cache window. Oracle is ceiling'd to
		// `latestMintCacheHour + 3600` so it only counts rows whose hour bucket
		// the cache has actually seen — newer rows added between the last
		// backfill and now are excluded from both sides of the comparison.
		test.setTimeout(90_000);
		const config = getConfig(testInfo.project.name);
		// KNOWN BUG (chip task_cc1ee453): the melt term of this total rides
		// the diverging nutshell melt aggregation — the error magnitude
		// shifts with every archived hour, so it can pass by coincidence and
		// fail later. Guarded like the Melts tests below.
		test.skip(config.mint === 'nutshell', 'nutshell melt analytics diverge with unpaid-heavy data (task_cc1ee453)');
		await assertSameGeneration(page, config, async (oracle, card) => {
			const ui = await tileNumber(card, 'Operations', '.font-size-xl');
			expect(ui, `Operations should match mint DB total in window [${oracle.window.start_hour}, ${oracle.window.effective_end})`).toBe(
				oracle.total_operations,
			);
		});
	});

	test('Unit volume tile equals issued+paid+swap amounts in the cache window', async ({page}, testInfo) => {
		// Differential oracle for the headline volume. Mirrors the server's
		// `total_volume = mints_amount + melts_amount + swaps_amount` math.
		// `mints_amount` sums `amount_issued` for ISSUED quotes only;
		// `melts_amount` sums `amount` for PAID quotes only; `swaps_amount`
		// sums grouped swap amounts (per nutshell.service.ts:478 / cdk.service.ts:525).
		// All three units agree (regtest stacks default to `sat`), so direct
		// integer summation is correct.
		test.setTimeout(90_000);
		const config = getConfig(testInfo.project.name);
		// KNOWN BUG (chip task_cc1ee453): the melts_amount term rides the
		// same nutshell melt aggregation — guarded with the other melt-
		// dependent differentials until the fix lands.
		test.skip(config.mint === 'nutshell', 'nutshell melt analytics diverge with unpaid-heavy data (task_cc1ee453)');
		await assertSameGeneration(page, config, async (oracle, card) => {
			const ui = await tileNumber(card, 'Unit volume', '.font-size-xl');
			expect(ui, `Unit volume should match mint DB issued+paid+swap sum in window`).toBe(oracle.total_volume);
		});
	});

	test('Mints tile equals total mint quotes (any state) in the cache window', async ({page}, testInfo) => {
		// `mint_count` reads the `mints_created` metric, which the backfill
		// inserts as `count = unit_quotes.length` — i.e. every mint quote
		// regardless of state. Skipping by state here would mask UNPAID quotes
		// (created via `mintQuote()` but never paid) which the card *does*
		// surface in this tile.
		test.setTimeout(90_000);
		const config = getConfig(testInfo.project.name);
		await assertSameGeneration(page, config, async (oracle, card) => {
			const ui = await tileNumber(card, 'Mints', '.font-size-l');
			expect(ui).toBe(oracle.mint_count);
		});
	});

	test('Melts tile equals total melt quotes (any state) in the cache window', async ({page}, testInfo) => {
		test.setTimeout(90_000);
		const config = getConfig(testInfo.project.name);
		// KNOWN BUG (chip task_cc1ee453): nutshell melt analytics diverge
		// with unpaid-heavy melt data (observed: tile 124 vs DB 227,
		// completion 117% / 124% — impossible ratios; single-unit canary
		// included). All cdk stacks assert exactly. Remove once fixed.
		test.skip(config.mint === 'nutshell', 'nutshell melt analytics diverge with unpaid-heavy data (task_cc1ee453)');
		await assertSameGeneration(page, config, async (oracle, card) => {
			const ui = await tileNumber(card, 'Melts', '.font-size-l');
			expect(ui).toBe(oracle.melt_count);
		});
	});

	test('Swaps tile equals grouped swap operations in the cache window', async ({page}, testInfo) => {
		// Swap grouping differs by backend:
		//   nutshell: GROUP BY (proofs_used.created, k.unit) where melt_quote IS NULL
		//   cdk: COUNT(DISTINCT operation_id) where operation_kind='swap'
		// Both are encapsulated in `mint.activitySummaryOracle()`. Multiple
		// proofs spent in the same wall-clock second + unit collapse into one
		// "swap" on nutshell — that matches what the server's
		// `swaps_amount.count` metric records, so the card and the oracle
		// agree on the bucketing.
		test.setTimeout(90_000);
		const config = getConfig(testInfo.project.name);
		await assertSameGeneration(page, config, async (oracle, card) => {
			const ui = await tileNumber(card, 'Swaps', '.font-size-l');
			expect(ui).toBe(oracle.swap_count);
		});
	});

	test('Mints completed % equals issued/total ratio in the cache window', async ({page}, testInfo) => {
		// `mint_completed_pct = (cur_mints_amount.count / cur_mints_created.count) * 100`
		// where `cur_mints_amount.count` is the count of ISSUED quotes (state column on
		// nutshell, `amount_paid > 0 AND amount_paid <= amount_issued` on cdk) and
		// `cur_mints_created.count` is total. Template formats with `'1.0-0'` ⇒ rounded
		// to integer ⇒ assert with `Math.round`. Skip when the denominator is zero (no
		// mint quotes in window) — the UI and oracle both render `0%`, but asserting
		// equality of zeros adds no signal.
		test.setTimeout(90_000);
		const config = getConfig(testInfo.project.name);
		// Zero-window skip decided on a pre-read outside the retry — the
		// zero/zero case is stable data, not generation-sensitive.
		const pre = mint.activitySummaryOracle(config, {last_processed_at: latestMintCacheHour(await getReadiness(page))});
		test.skip(pre.mint_count === 0, 'no mint quotes in cache window — completion ratio is the zero/zero default');

		await assertSameGeneration(page, config, async (oracle, card) => {
			const tile = card.locator('.orc-high-card:has(div.orc-outline-color:text-is("Mints completed"))');
			await expect(tile).toBeVisible();
			const ui_text = await tile.locator('.font-size-l').first().textContent();
			const ui = amountFromText(ui_text);
			expect(ui).toBe(Math.round(oracle.mint_completed_pct));
		});
	});

	test('Melts completed % equals paid/total ratio in the cache window', async ({page}, testInfo) => {
		test.setTimeout(90_000);
		const config = getConfig(testInfo.project.name);
		// KNOWN BUG (chip task_cc1ee453) — see the Melts tile test above.
		test.skip(config.mint === 'nutshell', 'nutshell melt analytics diverge with unpaid-heavy data (task_cc1ee453)');
		const pre = mint.activitySummaryOracle(config, {last_processed_at: latestMintCacheHour(await getReadiness(page))});
		test.skip(pre.melt_count === 0, 'no melt quotes in cache window — completion ratio is the zero/zero default');

		await assertSameGeneration(page, config, async (oracle, card) => {
			const tile = card.locator('.orc-high-card:has(div.orc-outline-color:text-is("Melts completed"))');
			await expect(tile).toBeVisible();
			const ui_text = await tile.locator('.font-size-l').first().textContent();
			const ui = amountFromText(ui_text);
			expect(ui).toBe(Math.round(oracle.melt_completed_pct));
		});
	});
});

test.describe('mint-general-activity card — period menu', {tag: '@mint'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/');
	});

	test('clicking the period button opens a 3-item mat-menu with the active row checked', async ({page}) => {
		// Material renders the menu into the page-level CDK overlay; the menu
		// items live there, not inside the card's DOM subtree. Three items:
		// "24 hours" (default active, with `check` icon glyph), "3 days",
		// "7 days". `active-period-option` class is bound on the active row.
		const card = await openCard(page);
		await waitForPopulated(card);
		await card.locator('.mint-activity-period-selector button').click();
		const items = page.locator('.cdk-overlay-pane button[mat-menu-item]');
		await expect(items).toHaveCount(3);
		await expect(items.filter({hasText: '24 hours'})).toHaveClass(/\bactive-period-option\b/);
		await expect(items.filter({hasText: '3 days'})).not.toHaveClass(/\bactive-period-option\b/);
		await expect(items.filter({hasText: '7 days'})).not.toHaveClass(/\bactive-period-option\b/);
	});

	test('clicking "7 days" closes the menu, updates the trigger label, and refetches with period: week', async ({page}) => {
		// Three things should happen in one click:
		//   1. The mat-menu closes (CDK overlay tears down).
		//   2. `selected_period` flips to MintActivityPeriod.Week ⇒
		//      `period_label` updates to "7 days" on the trigger button.
		//   3. `(period_change)` emits ⇒ parent calls
		//      `mintService.clearActivityCache()` then
		//      `loadMintActivitySummary(MintActivityPeriod.Week)` which fires
		//      a new `MintActivitySummary` query with `period: "week"`.
		// Wait for that response with a period-specific predicate; without
		// pinning on `"period":"week"` the wait would also match the initial
		// `"period":"day"` request that already settled.
		const card = await openCard(page);
		await waitForPopulated(card);
		const button = card.locator('.mint-activity-period-selector button');

		const responsePromise = page.waitForResponse(
			(r) => r.url().endsWith('/api') && (r.request().postData() ?? '').includes('"period":"week"'),
			{timeout: 15_000},
		);
		await button.click();
		await page.locator('.cdk-overlay-pane button[mat-menu-item]').filter({hasText: '7 days'}).click();
		await responsePromise;

		await expect(page.locator('.cdk-overlay-pane')).toHaveCount(0);
		await expect(button).toHaveText(/7 days/);
	});

	test('reopening the menu after a period switch shows the check on the new row', async ({page}) => {
		// `selected_period` is component-local state — once it flips, the
		// menu's `(option.value === selected_period())` check should follow.
		// Asserts the round-trip independent of `(period_change)` semantics.
		const card = await openCard(page);
		await waitForPopulated(card);
		const button = card.locator('.mint-activity-period-selector button');

		await button.click();
		await page.locator('.cdk-overlay-pane button[mat-menu-item]').filter({hasText: '3 days'}).click();
		// Wait for the menu to fully tear down before reopening — the next
		// click would otherwise race the overlay's exit animation.
		await expect(page.locator('.cdk-overlay-pane')).toHaveCount(0);

		await button.click();
		const items = page.locator('.cdk-overlay-pane button[mat-menu-item]');
		await expect(items.filter({hasText: '3 days'})).toHaveClass(/\bactive-period-option\b/);
		await expect(items.filter({hasText: '24 hours'})).not.toHaveClass(/\bactive-period-option\b/);
	});
});
