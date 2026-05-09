/**
 * Feature spec: `orc-mint-general-keysets` — the "Keysets" card on `/mint`
 * summarising the daemon's keyset inventory and the underlying database
 * footprint.
 *
 * Two surfaces, two readiness profiles:
 *   - Structure that holds on every stack the moment the card mounts —
 *     title, mat-card, active/inactive count + top fill bar, unit chip-set
 *     against `mintUnitsFor(config)`, database row's titlecase engine
 *     label + non-zero size. These are `@mint`; no readiness gate beyond
 *     the resolver settling.
 *   - Blind sigs / Proofs totals + the per-stat sub-bars are
 *     analytics-sensitive: the values come from the
 *     `mint_keyset_counts` GraphQL resolver, which reads from Orchard's
 *     analytics archive (`analytics_mint`'s hourly buckets), NOT directly
 *     from the daemon DB. On a stack where backfill hasn't run yet both
 *     totals render 0 even when the daemon has plenty of operations.
 *     These are `@analytics` and gate on `mintAnalyticsHasRows`.
 *
 * Coverage:
 *   - structure: title, mat-card mount, chip count + chip text vs.
 *     `mintUnitsFor(config)`, active/inactive counts + top bar width
 *     vs. `mint.keysets(config)` truth
 *   - database row: titlecase engine matches `config.db`; size renders
 *     as a positive byte string via `dataBytes` (shape-only — exact
 *     bytes vary by stack and postgres jitter, not worth differentialing)
 *   - analytics-sensitive: Blind sigs + Proofs totals match the daemon
 *     DB's row count windowed to the latest completed analytics hour
 *     (`mint.keysetCountsOracle` mirrors what backfill rolls into the
 *     archive); both percentage labels live in [0, 100] and agree with
 *     the sub-bar widths
 *
 * States the component supports but this spec does NOT cover (see
 * `mint-general-keysets.md` → "Skip taxonomy"):
 *   - mixed active/inactive after rotation (`disruptive` — would mutate
 *     downstream specs that assume one active keyset per unit)
 *   - empty `keysets()` (`dead-branch` — daemons auto-provision sat)
 *   - `database_info === null` (`disruptive` — would knock out sibling
 *     specs that share the resolver)
 *   - multi-unit chip rendering (sat + usd / eur) — `stack-only`, only
 *     reachable on `fake-cdk-postgres` which isn't in today's matrix
 * See `mint-general-keysets.md` for the full state machine.
 */

import {test, expect, type Locator, type Page} from '@playwright/test';

import {getConfig, mintUnitsFor} from '@e2e/helpers/config';
import {mint} from '@e2e/helpers/backend';
import {getReadiness, mintAnalyticsHasRows, requireReady} from '@e2e/helpers/ui/readiness';
import type {Readiness} from '@e2e/types/readiness';

/** Latest hour bucket the `analytics_mint` cache has produced rows for —
 *  same derivation the activity card spec uses (`latestMintCacheHour`).
 *  Backfill skips any bucket `>= current_hour` (mintanalytics.service.ts:248-249),
 *  so this is the most recent COMPLETED hour the archive has counted.
 *  The card's lifetime totals come from `getCachedAnalytics` with no date
 *  filter, so the daemon-DB oracle pairs against this ceiling +3600 to
 *  match what the archive has had a chance to roll up. */
function latestMintCacheHour(readiness: Readiness): number {
	return readiness.mint_analytics_recent.reduce((max, row) => Math.max(max, row.date), 0);
}

async function openCard(page: Page): Promise<Locator> {
	// Only one mount: the `/mint` subsection dashboard. Scope by selector
	// (no `.first()`) so a regression that mounts a stray copy elsewhere
	// surfaces as a strict-mode failure.
	const card = page.locator('orc-mint-general-keysets');
	await expect(card).toBeVisible();
	// The card's three resolvers (`mintKeysets`, `mintKeysetCounts`,
	// `mintDatabaseInfo`) all settle before the route activates, but the
	// child mat-card is the cheapest "card has rendered" probe and stays
	// stable across every reachable state including `keysets() === []`.
	await expect(card.locator('mat-card')).toBeVisible();
	return card;
}

/** Strip non-digits to recover the integer Angular's `number` pipe wraps in
 *  locale formatting (e.g. `"1,234,567"` → `1234567`). Returns 0 for empty
 *  / null text so the zero-state assertions don't trip on NaN. */
function amountFromText(text: string | null | undefined): number {
	const stripped = (text ?? '').replace(/\D/g, '');
	return stripped === '' ? 0 : parseInt(stripped, 10);
}

/** Read the inline `width: NN%` token from a `[style.width.%]` binding.
 *  Asserts on the rendered percent rather than `getComputedStyle().width`
 *  to dodge sub-pixel rounding (`width: 40%` and `width: 40.001%` both
 *  resolve to the same px on the canvas, but the inline string preserves
 *  the integer the binding produced). Returns `NaN` if the style is
 *  missing — caller should treat that as a binding regression. */
async function readWidthPercent(el: Locator): Promise<number> {
	const style = (await el.getAttribute('style')) ?? '';
	const m = style.match(/width:\s*([\d.]+)%/);
	return m ? parseFloat(m[1]) : NaN;
}

/** Title-case the daemon's database engine the same way the template does
 *  (`{{ database_info()?.type | titlecase }}`). `'sqlite'` → `'Sqlite'`,
 *  `'postgres'` → `'Postgres'`. Derived from `config.db` so the assertion
 *  stays aligned with the helper rather than hard-coding strings. */
function expectedEngineLabel(db: 'sqlite' | 'postgres'): string {
	return db.charAt(0).toUpperCase() + db.slice(1);
}

test.describe('mint-general-keysets card — structure', {tag: '@mint'}, () => {
	test.beforeEach(async ({page}) => {
		// `/mint` is the only route that mounts this card (the index
		// dashboard hosts the Cashu mint info / config / activity / balance
		// surfaces but not this keysets summary).
		await page.goto('/mint');
	});

	test('renders the keysets card with a "Keysets" title', async ({page}) => {
		const card = await openCard(page);
		await expect(card.getByText('Keysets', {exact: true})).toBeVisible();
		await expect(card.locator('mat-card')).toHaveCount(1);
	});

	test('renders one chip per provisioned mint unit', async ({page}, testInfo) => {
		// Chip count is daemon-driven via `unique_units(keysets)`. Both
		// nutshell and cdk emit one keyset per provisioned unit, so the
		// chip count agrees with `mintUnitsFor(config)` (which parses the
		// stack's mintd.toml / compose.yml directly). Future fixtures that
		// add usd/eur will pick up the additional chips without code change.
		const config = getConfig(testInfo.project.name);
		const expected_units = mintUnitsFor(config).length;
		const card = await openCard(page);
		await expect(card.locator('mat-chip')).toHaveCount(expected_units);
	});

	test('chip text matches each provisioned unit (uppercased)', async ({page}, testInfo) => {
		// Differential. The template renders `{{ unit | uppercase }}`, so
		// every chip's trimmed text equals `unit.toUpperCase()`. Order is
		// daemon emission order — both daemons emit `sat` first, but assert
		// on the *set* rather than indexed order to stay resilient to a
		// future schema reordering.
		const config = getConfig(testInfo.project.name);
		const expected_set = new Set(mintUnitsFor(config).map((u) => u.toUpperCase()));
		const card = await openCard(page);
		const labels = await card.locator('mat-chip').allTextContents();
		expect(new Set(labels.map((l) => l.trim()))).toEqual(expected_set);
	});

	test('renders the "Units" caption beneath the chip set', async ({page}) => {
		const card = await openCard(page);
		await expect(card.getByText('Units', {exact: true})).toBeVisible();
	});

	test('active count matches the daemon DB count of active keysets', async ({page}, testInfo) => {
		// Differential oracle: `mint.keysets(config)` reads the daemon's
		// `keyset` / `keysets` table directly. The component's
		// `active_count` is a pure `keysets().filter(k => k.active).length`,
		// so the rendered span equals the helper's filter. Scope by the
		// active span's class to dodge collisions with the sub-card numerics.
		const config = getConfig(testInfo.project.name);
		const expected = mint.keysets(config).filter((k) => k.active).length;
		const card = await openCard(page);
		const text = await card.locator('.font-size-l.font-weight-semi-bold').first().textContent();
		expect(amountFromText(text)).toBe(expected);
	});

	test('inactive count matches the daemon DB count of inactive keysets', async ({page}, testInfo) => {
		// Mirror of the active test. The component computes inactive by
		// subtraction (`total - active_count`), but on a clean stack both
		// approaches agree — the helper emits one row per keyset row in the
		// daemon DB. Scope by the trailing `<n> inactive` text whose pattern
		// is unique within the card.
		const config = getConfig(testInfo.project.name);
		const all = mint.keysets(config);
		const expected = all.length - all.filter((k) => k.active).length;
		const card = await openCard(page);
		const text = await card.getByText(/^\d+ inactive$/).textContent();
		expect(amountFromText(text)).toBe(expected);
	});

	test('top fill bar width matches the active fraction of all keysets', async ({page}, testInfo) => {
		// `[style.width.%]="active_percentage()"` — assert the inline percent
		// matches `(active / total) * 100`, within 0.5% to absorb whatever
		// `parseFloat`-style rounding Angular's binding might apply.
		// `.keyset-bar:not(.keyset-bar-sm)` picks the lg bar; the two
		// `.keyset-bar-sm` siblings live inside the sub-cards.
		const config = getConfig(testInfo.project.name);
		const all = mint.keysets(config);
		const active = all.filter((k) => k.active).length;
		const expected = all.length === 0 ? 0 : (active / all.length) * 100;
		const card = await openCard(page);
		const fill = card.locator('.keyset-bar:not(.keyset-bar-sm) .keyset-bar-fill');
		const width = await readWidthPercent(fill);
		expect(width).toBeGreaterThanOrEqual(0);
		expect(width).toBeLessThanOrEqual(100);
		expect(Math.abs(width - expected)).toBeLessThan(0.5);
	});

	test('database row sublabel reflects the stack\'s engine (Sqlite / Postgres)', async ({page}, testInfo) => {
		// `{{ database_info()?.type | titlecase }} database size`. The
		// daemon-level engine is fixed by `config.db` for the stack, so
		// derive the expected string rather than hard-coding per-stack —
		// this stays aligned if a new engine ever joins the `db` enum.
		const config = getConfig(testInfo.project.name);
		const expected_label = `${expectedEngineLabel(config.db)} database size`;
		const card = await openCard(page);
		await expect(card.getByText(expected_label, {exact: true})).toBeVisible();
	});

	test('database row size renders as a non-zero byte string via dataBytes', async ({page}) => {
		// Both sqlite (file size on disk) and postgres (`pg_database_size`)
		// return positive integers on every running stack. The `dataBytes`
		// pipe formats as `<n>[.<dd>] <unit>` with units `B / kB / MB / GB
		// / TB`. Don't assert exact value — postgres jitter and sqlite's
		// 2dp rounding both shift the reading between probes — assert
		// shape (positive) and unit (one of the documented strings).
		const card = await openCard(page);
		const row = card.getByText(/database size$/).locator('..');
		const size_text = (await row.locator('.font-size-l.font-weight-semi-bold').textContent()) ?? '';
		expect(size_text).toMatch(/^\d+(?:\.\d+)?\s*(?:B|kB|MB|GB|TB)$/);
		// Strip the unit and assert the number > 0 — the `'0 B'` pipe
		// short-circuit only fires when the size is null/undefined/0,
		// which `mintDatabaseInfoResolver` never emits on a healthy stack.
		const numeric = parseFloat(size_text);
		expect(numeric, 'database size should be > 0 on a running stack').toBeGreaterThan(0);
	});
});

test.describe('mint-general-keysets card — archive↔DB differential', {tag: '@analytics'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/mint');
		// Blind sigs / Proofs come from `mint_keyset_counts`, which reads
		// the `analytics_mint` archive (mintkeyset.service.ts:42), NOT the
		// daemon DB directly. Skip cleanly until backfill has produced at
		// least one bucketed row — same gate the activity card uses, since
		// both surfaces are downstream of the same archive.
		await requireReady(page, mintAnalyticsHasRows);
	});

	test('Blind sigs total equals daemon-DB promise count up through the latest archived hour', async ({page}, testInfo) => {
		// Differential oracle. The card sums `keyset_issued.count` across
		// every archived hour (no date filter on `getCachedAnalytics`).
		// Backfill only buckets completed hours, so the archive's coverage
		// ceiling is `latestMintCacheHour + 3600`. The oracle counts daemon-DB
		// promise rows whose `created_time < ceiling` — equal to the UI
		// total when backfill has run end-to-end through the ceiling hour.
		// nutshell: `promises.created`; cdk: `blind_signature.created_time`.
		const config = getConfig(testInfo.project.name);
		const readiness = await getReadiness(page);
		const oracle = mint.keysetCountsOracle(config, {last_processed_at: latestMintCacheHour(readiness)});
		const card = await openCard(page);
		const tile = card.locator('.orc-high-card', {hasText: 'Blind sigs'});
		await expect(tile).toBeVisible();
		const text = await tile.locator('.font-size-l.font-weight-semi-bold').textContent();
		expect(amountFromText(text), `Blind sigs should match daemon promise count < ${oracle.window.effective_end}`).toBe(
			oracle.total_promises,
		);
	});

	test('Proofs total equals daemon-DB proof count up through the latest archived hour', async ({page}, testInfo) => {
		// Mirror of the Blind sigs assertion. Card sums `keyset_redeemed.count`;
		// oracle counts `proof.created_time` (cdk) or `proofs_used.created`
		// (nutshell), windowed identically.
		const config = getConfig(testInfo.project.name);
		const readiness = await getReadiness(page);
		const oracle = mint.keysetCountsOracle(config, {last_processed_at: latestMintCacheHour(readiness)});
		const card = await openCard(page);
		const tile = card.locator('.orc-high-card', {hasText: 'Proofs'});
		await expect(tile).toBeVisible();
		const text = await tile.locator('.font-size-l.font-weight-semi-bold').textContent();
		expect(amountFromText(text), `Proofs should match daemon proof count < ${oracle.window.effective_end}`).toBe(
			oracle.total_proofs,
		);
	});

	test('Blind sigs sub-bar fills to a percentage in [0, 100] that agrees with its label', async ({page}) => {
		// `active_promises_percentage` = `active / total * 100` with a
		// zero-division guard returning 0; the bar binding and the
		// `'1.0-0'` label round the same fraction. Assert both stay in
		// range and agree within ±1 to absorb the int-rounding gap. The
		// invariant `active <= total` is what keeps the percent <= 100;
		// breach here means the active filter or the count sum is broken.
		// Pick the percentage label by its `.orc-outline-color` class +
		// "active keysets" hasText — both per-stat tiles render exactly one
		// such span, so the locator is unambiguous within the tile.
		const card = await openCard(page);
		const tile = card.locator('.orc-high-card', {hasText: 'Blind sigs'});
		await expect(tile).toBeVisible();
		const label_text = await tile.locator('.orc-outline-color', {hasText: 'active keysets'}).textContent();
		const label_pct = amountFromText(label_text);
		expect(label_pct).toBeGreaterThanOrEqual(0);
		expect(label_pct).toBeLessThanOrEqual(100);
		const width = await readWidthPercent(tile.locator('.keyset-bar-fill'));
		expect(width).toBeGreaterThanOrEqual(0);
		expect(width).toBeLessThanOrEqual(100);
		expect(Math.abs(width - label_pct)).toBeLessThanOrEqual(1);
	});

	test('Proofs sub-bar fills to a percentage in [0, 100] that agrees with its label', async ({page}) => {
		const card = await openCard(page);
		const tile = card.locator('.orc-high-card', {hasText: 'Proofs'});
		await expect(tile).toBeVisible();
		const label_text = await tile.locator('.orc-outline-color', {hasText: 'active keysets'}).textContent();
		const label_pct = amountFromText(label_text);
		expect(label_pct).toBeGreaterThanOrEqual(0);
		expect(label_pct).toBeLessThanOrEqual(100);
		const width = await readWidthPercent(tile.locator('.keyset-bar-fill'));
		expect(width).toBeGreaterThanOrEqual(0);
		expect(width).toBeLessThanOrEqual(100);
		expect(Math.abs(width - label_pct)).toBeLessThanOrEqual(1);
	});
});
