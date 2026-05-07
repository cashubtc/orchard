/**
 * Feature spec: `orc-mint-subsection-dashboard` — the Nutalytics control +
 * 6-chart grid on the `/mint` route. The host also renders a Mint summary
 * card and an `orc-mint-general-balance-sheet` summary above Nutalytics;
 * those have their own specs, so this one scopes to the Nutalytics surface.
 *
 * Coverage by tag (project grep wires each describe to the right stacks):
 *   - `@canary`: smoke render — control + all 6 chart cards mount, Interval
 *     defaults to Day, the chart-type defaults match the spec (Totals for
 *     Balance Sheet & Ecash, Volume for Mints/Melts/Swaps/Fee Revenue).
 *   - `@mint`: structural that holds on every stack — Filters menu opens
 *     with one Units checkbox per provisioned unit and (default) no Oracle
 *     section, per-chart type toggle is independent, tertiary nav reorders
 *     the grid, mobile collapses the inline form fields into Filters.
 *   - `@analytics`: differential — driving the Interval Day → Hour change
 *     fires a fresh `mint_analytics_balances` GraphQL POST whose response
 *     for `unit=sat` is structurally consistent with the daemon DB
 *     (`mint.balance(config, 'sat')`). The chart's per-bucket value is
 *     opaque from the DOM — Chart.js renders to canvas — so the assertion
 *     is "the GraphQL pipeline returned non-empty SAT data AND the live
 *     daemon balance is non-zero", anchoring data accuracy at the request
 *     level. Per-bucket value fidelity is deferred to the Karma test on
 *     the chart helpers (`getAmountChartData`) and to the balance-sheet
 *     summary card spec which already asserts `mint.balance` against
 *     rendered text on the same page.
 *
 * States the component supports but this spec does NOT cover (see
 * `mint-subsection-dashboard.md` → "Skip taxonomy"):
 *   - archiving progress bar (`disruptive` — backfill is a daemon cron,
 *     no admin endpoint to trigger on demand)
 *   - analytics fetch error → silent UI (`disruptive` — `docker pause`
 *     would knock out sibling specs)
 *   - oracle-on filter section (`synthetic` — toggling the app setting
 *     mid-test would leak across the worker; covered by Karma)
 *   - "No fee revenue" / Watchdog overlays on the Fee Revenue chart
 *     (`fixture-only` and `stack-only` + `disruptive`)
 *   - per-chart Totals/Volume canvas geometry differential (Chart.js
 *     canvas; covered by Karma `mintChartDataHelpers`)
 *   - oracle-converted axis labels (`synthetic`)
 * See `mint-subsection-dashboard.md` for the full state machine.
 */

import {test, expect, type Locator, type Page} from '@playwright/test';

import {getConfig, mintUnitsFor} from '@e2e/helpers/config';
import {ln, mint} from '@e2e/helpers/backend';
import {matchGql} from '@e2e/helpers/ui/gql-intercept';
import {getReadiness, lightningAnalyticsHasRows, mintAnalyticsHasRows, requireReady} from '@e2e/helpers/ui/readiness';

/** Each chart card lives in its own `grid-area`-bound div with a stable
 *  `chart-<key>` class. Mapping by key keeps the assertions readable. */
const CHART_KEYS = ['balance-sheet', 'mints', 'melts', 'swaps', 'fee-revenue', 'ecash'] as const;
type ChartKey = (typeof CHART_KEYS)[number];

/** Default chart-type per key — mirrors `getPageSettings()` in the host. The
 *  first time a stack visits `/mint` these defaults seed `localStorage`;
 *  subsequent runs reuse whatever the user (or a prior test) wrote. The
 *  settings.setup.ts phase doesn't touch dashboard settings, so on a fresh
 *  stack these values hold. */
const DEFAULT_CHART_TYPE: Record<ChartKey, 'Totals' | 'Volume'> = {
	'balance-sheet': 'Totals',
	mints: 'Volume',
	melts: 'Volume',
	swaps: 'Volume',
	'fee-revenue': 'Volume',
	ecash: 'Totals',
};

async function openDashboard(page: Page): Promise<Locator> {
	const host = page.locator('orc-mint-subsection-dashboard');
	await expect(host).toBeVisible();
	// Control mounts inside `@if (page_settings())`, which is true after the
	// constructor reads route data — so the control's presence is the cheapest
	// "host has settled enough to interact" probe.
	await expect(host.locator('orc-mint-subsection-dashboard-control')).toBeVisible();
	return host;
}

/** Wait for the 6 chart cards to mount. They render unconditionally inside
 *  the host template — the only gate is the host itself, which we already
 *  awaited via `openDashboard`. This is a strict-count assertion: a regression
 *  that drops a card surfaces here, not deep inside a per-state probe. */
async function waitForChartGrid(host: Locator): Promise<void> {
	await expect(host.locator(CHART_KEYS.map((k) => `.chart-${k}`).join(', '))).toHaveCount(CHART_KEYS.length);
}

/** Locator for the chart-type trigger button on a given chart card. The host
 *  template puts exactly one `.mint-analytic-selector button` per card; scoping
 *  by `.chart-<key>` keeps the locator unambiguous. */
function chartTypeButton(host: Locator, key: ChartKey): Locator {
	return host.locator(`.chart-${key} .mint-analytic-selector button`);
}

/** Read the chart-type label rendered next to the bar_chart icon
 *  (`{{ type_<key>() | titlecase }}`). Trim because the icon ligature name
 *  collides into the text content otherwise. */
async function readChartTypeLabel(host: Locator, key: ChartKey): Promise<string> {
	const button = chartTypeButton(host, key);
	// The button reads "bar_chartTotals" or "bar_chartVolume" — strip the icon
	// ligature prefix to recover just the type label.
	const text = (await button.textContent()) ?? '';
	return text.replace(/^bar_chart/, '').trim();
}

/** Open the chart-type mat-menu for a given chart and pick a type. The menu
 *  closes on selection; caller can then re-read the button label to confirm. */
async function pickChartType(page: Page, host: Locator, key: ChartKey, type: 'Totals' | 'Volume'): Promise<void> {
	await chartTypeButton(host, key).click();
	const menu = page.locator('.cdk-overlay-container .mat-mdc-menu-panel').last();
	await expect(menu).toBeVisible();
	await menu.getByRole('menuitem', {name: type, exact: true}).click();
	await expect(menu).toBeHidden();
}

/** Recover the integer amount from a GraphQL `mint_analytics_balances` row.
 *  The resolver returns `amount` as a string (BigInt-safe across the wire);
 *  parseInt is fine here because real bucket sums comfortably fit in a
 *  JS number — overflow only matters at the BigInt boundary inside the
 *  server's aggregation (mintanalytics.service.ts:48-66). */
function rowAmount(row: unknown): number {
	const amount = (row as {amount: string}).amount;
	return parseInt(amount, 10);
}

test.describe('mint-subsection-dashboard — smoke', {tag: '@canary'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/mint');
	});

	test('renders the Nutalytics control + all 6 chart cards', async ({page}) => {
		// Strict count: a regression that drops a card surfaces here. The 6
		// cards are positionally addressed via `.chart-<key>` — the same
		// classes the host's grid-area CSS targets, so this also confirms the
		// SCSS-bound grid keys haven't drifted from the template.
		const host = await openDashboard(page);
		await waitForChartGrid(host);
		await expect(host.locator('.title-l').filter({hasText: 'Nutalytics'})).toBeVisible();
	});

	test('Interval select defaults to "Day"', async ({page}) => {
		// Default `getPageSettings()` returns `interval: AnalyticsInterval.Day`
		// when nothing is in localStorage — the canary stack has no prior
		// dashboard settings written by setup, so this is the cold-start
		// reading. Future settings.setup.ts changes that touch dashboard
		// settings would invalidate this — note that.
		const host = await openDashboard(page);
		const select = host.locator('orc-mint-subsection-dashboard-control mat-select');
		await expect(select).toContainText('Day');
	});

	test('each chart card exposes a chart-type trigger with the expected default label', async ({page}) => {
		// Default chart-type per chart is hardcoded in `getPageSettings()` —
		// Totals for balance-sheet & ecash, Volume for mints/melts/swaps/fee.
		// This catches a regression where the host's default ?? falls back
		// to the wrong enum.
		const host = await openDashboard(page);
		await waitForChartGrid(host);
		for (const key of CHART_KEYS) {
			const label = await readChartTypeLabel(host, key);
			expect(label, `chart-${key} default type label`).toBe(DEFAULT_CHART_TYPE[key]);
		}
	});
});

test.describe('mint-subsection-dashboard — control', {tag: '@mint'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/mint');
	});

	test('Filters menu opens with one Units checkbox per provisioned unit (no Oracle section by default)', async ({page}, testInfo) => {
		// `unit_options` is built from `unique_units(keysets())` so the count
		// equals `mintUnitsFor(config)` (same backend source). The Oracle
		// section is gated on `bitcoin_oracle_enabled()` — only the @oracle
		// stack (cln-nutshell-postgres) flips that on, and even then the
		// canary/@mint grep keeps this test to oracle-off projects.
		const config = getConfig(testInfo.project.name);
		test.skip(
			config.appSettings?.bitcoin_oracle === true,
			'oracle-on stacks expose an Oracle section in the filter menu — covered separately',
		);
		const host = await openDashboard(page);
		const filters_button = host
			.locator('orc-mint-subsection-dashboard-control button')
			.filter({hasText: 'Filters'});
		await filters_button.click();
		const menu = page.locator('.cdk-overlay-container .orc-filter-menu');
		await expect(menu).toBeVisible();

		// Units section: header + one checkbox per provisioned unit.
		await expect(menu.getByText('Units', {exact: true})).toBeVisible();
		const expected_units = mintUnitsFor(config).length;
		await expect(menu.locator('mat-checkbox')).toHaveCount(expected_units);

		// No Oracle section when bitcoin_oracle_enabled is false.
		await expect(menu.getByText('Oracle', {exact: true})).toHaveCount(0);
	});

	test('per-chart type toggle is independent — flipping Mints to Totals leaves Melts in Volume', async ({page}) => {
		// `onChartTypeChange(key, type)` mutates only `page_settings.type[key]`
		// and persists; the other charts' computeds re-read but produce the
		// same value. A regression where the host applies the change globally
		// (or where a stale ref leaks across keys) surfaces here.
		const host = await openDashboard(page);
		await waitForChartGrid(host);

		// Mints starts on Volume per the defaults asserted above.
		expect(await readChartTypeLabel(host, 'mints')).toBe('Volume');
		expect(await readChartTypeLabel(host, 'melts')).toBe('Volume');

		await pickChartType(page, host, 'mints', 'Totals');

		// Mints flipped, Melts unchanged.
		await expect(chartTypeButton(host, 'mints')).toContainText('Totals');
		await expect(chartTypeButton(host, 'melts')).toContainText('Volume');

		// Restore to default so subsequent tests in this describe see the
		// expected starting state. (Tests in a file run serially on one
		// worker per Playwright's default, so this matters.)
		await pickChartType(page, host, 'mints', 'Volume');
		await expect(chartTypeButton(host, 'mints')).toContainText('Volume');
	});

	test('mobile viewport collapses Date range and Interval into the Filters menu', async ({page}) => {
		// `device_type === 'mobile'` (XSmall breakpoint) hides the inline
		// Date range / Interval form fields in the control's desktop branch
		// and re-renders them inside the Filters menu instead. The breakpoint
		// observer fires synchronously off the resize, but the form-field
		// removal is gated on a CD cycle — wait for the start-date input to
		// disappear before asserting the menu shape.
		const host = await openDashboard(page);
		// Inline form fields visible on desktop default.
		await expect(host.locator('orc-mint-subsection-dashboard-control input[matStartDate]')).toBeVisible();

		await page.setViewportSize({width: 375, height: 812});
		await expect(host.locator('orc-mint-subsection-dashboard-control input[matStartDate]')).toHaveCount(0);

		// Filters button still present; opening it now reveals the relocated
		// form fields per the control's mobile branch in the template.
		const filters_button = host
			.locator('orc-mint-subsection-dashboard-control button')
			.filter({hasText: 'Filters'});
		await filters_button.click();
		const menu = page.locator('.cdk-overlay-container .orc-filter-menu');
		await expect(menu).toBeVisible();
		await expect(menu.locator('input[matStartDate]')).toBeVisible();
		await expect(menu.locator('mat-select')).toBeVisible();
	});
});

test.describe('mint-subsection-dashboard — analytics pipeline', {tag: '@analytics'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/mint');
		// `mint_analytics_balances` is an analytics-archive resolver, same as
		// the activity card and keysets card — gate on the same readiness
		// predicate so the test skips cleanly until backfill has produced at
		// least one bucket.
		await requireReady(page, mintAnalyticsHasRows);
	});

	test('Interval Day → Hour fires a fresh mint_analytics_balances request with interval=hour, and the response is consistent with the daemon DB', async ({
		page,
	}, testInfo) => {
		// Two-part assertion:
		//   1. The interval change re-issues the GraphQL request with the new
		//      interval (request-side proof that the control wired correctly
		//      into `reloadDynamicData`).
		//   2. The response payload for unit=sat is non-empty whenever the
		//      daemon DB shows non-zero outstanding ecash for sat. This anchors
		//      data accuracy at the resolver boundary: if the archive is empty
		//      when the daemon has live balance, the chart will silently
		//      render its `bar_chart_off` overlay and operators see "no data"
		//      where they expect a curve. Per-bucket value fidelity is opaque
		//      from the DOM (Chart.js paints to canvas) — that's covered by
		//      Karma on the chart-data helpers.
		const config = getConfig(testInfo.project.name);
		const host = await openDashboard(page);
		await waitForChartGrid(host);

		// Default interval is Day; pick Hour and capture the resulting
		// `mint_analytics_balances` POST whose body carries `"interval":"hour"`.
		// The pre-window call also hits the same query name with
		// `"interval":"custom"`, so filter by post-data substring to avoid
		// matching the wrong one.
		const balances_response = page.waitForResponse(
			(r) =>
				matchGql('mint_analytics_balances')(r) &&
				(r.request().postData() ?? '').includes('"interval":"hour"'),
		);
		// mat-select exposes role="combobox" once Material's a11y tree settles
		// — this is the same pattern `e2e/helpers/ui/settings.ts:applyCurrency`
		// uses for the currency selects. Plain `.click()` on the wrapping
		// `mat-select` element opens the panel inconsistently in production
		// builds (the click target moves between the trigger value and the
		// arrow chevron); the combobox role resolves to the focusable trigger.
		await host.locator('orc-mint-subsection-dashboard-control').getByRole('combobox').click();
		await page.getByRole('option', {name: 'Hour', exact: true}).click();
		const response = await balances_response;
		const body = await response.json();
		expect(body.errors, 'mint_analytics_balances should not error').toBeFalsy();

		const rows = (body.data?.mint_analytics_balances ?? []) as Array<{date: number; unit: string; amount: string}>;
		const sat_rows = rows.filter((r) => r.unit === 'sat');
		const sat_balance = mint.balance(config, 'sat');
		if (sat_balance > 0) {
			// Daemon has outstanding sat ecash → the analytics archive must
			// have at least one non-zero sat bucket *somewhere* in the window
			// (the resolver filters `amount !== '0'` server-side, so empty
			// here means the archive genuinely has nothing for sat in the
			// current window). Assert at least one row AND the cumulative
			// sum across the response is positive — proves the data has the
			// right sign for "outstanding ecash exists".
			expect(sat_rows.length, 'archive should have at least one sat bucket when daemon balance > 0').toBeGreaterThan(0);
			const archive_sum = sat_rows.reduce((acc, r) => acc + rowAmount(r), 0);
			expect(archive_sum, 'sum of sat issued − redeemed across visible buckets should be positive').toBeGreaterThan(0);
		} else {
			// Daemon has zero outstanding ecash → archive may still have
			// zero-sum buckets (a mint that issued and redeemed identically),
			// but the resolver strips amount==0 rows so we can't distinguish.
			// Just assert the request succeeded (covered above).
		}

		// And confirm the UI surfaced the new bucket density: with Hour, the
		// chart canvas re-renders. We can't read pixel values, but we can
		// assert the chart-type label remained Totals (its default) — i.e.
		// the interval change didn't accidentally toggle chart-type too.
		await expect(chartTypeButton(host, 'balance-sheet')).toContainText('Totals');

		// Restore to default so the smoke `Interval defaults to "Day"` assertion
		// holds on a re-run within the same project (storageState persists across
		// tests in a project run). Clear via localStorage rather than driving
		// the mat-select again — Material's CDK overlay panel doesn't reliably
		// re-open in this same-page sequence under production-build a11y, and
		// the storage key is the canonical source the host reads on next mount.
		// Key from `local-storage.service.ts:40` (`MINT_DASHBOARD_KEY`).
		await page.evaluate(() => localStorage.removeItem('v3.mint.dashboard.settings'));
	});

	test('mint_analytics_balances cumulative sum for sat equals daemon-DB issued − redeemed at the cache ceiling', async ({
		page,
	}, testInfo) => {
		// Per-bucket value-equals-oracle differential. The chart's Totals
		// mode renders cumulative `issued − redeemed` per unit per bucket,
		// summing all visible buckets to get the rightmost total. Setting
		// `date_start = epoch_start` and `date_end = ceiling` (the latest
		// archived hour boundary) makes the response cover the entire
		// historical window — sum of `amount` across all rows for unit=sat
		// should equal `mint.balanceWindow({unit: 'sat', last_processed_at})`,
		// which reads `promises.amount − proofs_used.amount` (nutshell) /
		// `blind_signature.amount − proof.amount` (cdk) directly from the
		// daemon DB up to the same ceiling. A divergence here indicates the
		// archive's per-hour buckets sum differently than the daemon's
		// per-row aggregation — i.e. backfill skipped or double-counted
		// rows somewhere.
		const config = getConfig(testInfo.project.name);
		const readiness = await getReadiness(page);
		const last_processed_at = readiness.mint_analytics_recent.reduce((max, row) => Math.max(max, row.date), 0);
		const oracle = mint.balanceWindow(config, {unit: 'sat', last_processed_at});
		test.skip(oracle.issued === 0 && oracle.redeemed === 0, 'no archived sat activity yet on this stack to anchor the differential');

		// Issue the query directly against `/api` with the same shape
		// `loadMintAnalytics()` uses. `interval: hour` keeps buckets aligned
		// with how backfill writes the archive (one row per hour); summing
		// across buckets recovers the cumulative window total.
		const raw = await page.evaluate(() => localStorage.getItem('v0.auth.token'));
		const token = raw ? (JSON.parse(raw) as string) : null;
		const headers: Record<string, string> = token ? {Authorization: `Bearer ${token}`} : {};
		const query = `query Balances($date_start: UnixTimestamp, $date_end: UnixTimestamp) {
			mint_analytics_balances(units: [sat], date_start: $date_start, date_end: $date_end, interval: hour) {
				date unit amount
			}
		}`;
		// `epoch_start` is hardcoded to 0 in the resolver pre-window math but the
		// archive only contains rows from the mint's first activity onwards, so
		// passing 0 here is safe.
		const variables = {date_start: 0, date_end: oracle.window.effective_end};
		const response = await page.request.post('/api', {headers, data: {query, variables}});
		expect(response.ok(), 'mint_analytics_balances should respond OK').toBe(true);
		const body = await response.json();
		expect(body.errors, 'mint_analytics_balances should not error').toBeFalsy();
		const rows = (body.data.mint_analytics_balances ?? []) as Array<{date: number; unit: string; amount: string}>;
		const sat_rows = rows.filter((r) => r.unit === 'sat');
		const archive_sum = sat_rows.reduce((acc, r) => acc + parseInt(r.amount, 10), 0);
		expect(
			archive_sum,
			`archive cumulative sum should equal daemon DB issued (${oracle.issued}) − redeemed (${oracle.redeemed}) at ceiling ${oracle.window.effective_end}`,
		).toBe(oracle.balance);
	});

	// One row per per-chart amount metric. Each test:
	//   1. Reads the latest archived hour from `getReadiness`.
	//   2. Asks Orchard for the chart's full historical window via the same
	//      GraphQL resolver `loadMintAnalytics()` calls.
	//   3. Sums response amounts for unit=sat across all buckets.
	//   4. Asserts equality to `mint.metricWindow(_, {metric, unit, ceiling})`,
	//      which mirrors the daemon-DB aggregation backfill consumes.
	// Divergence here points at backfill's per-hour insert math (compare to
	// `mintanalytics.service.ts` `insert{MintQuote,MeltQuote,Swap,Fee}Metrics`).
	const AMOUNT_METRICS: ReadonlyArray<{
		query: 'mint_analytics_mints' | 'mint_analytics_melts' | 'mint_analytics_swaps' | 'mint_analytics_fees';
		metric: 'mints_amount' | 'melts_amount' | 'swaps_amount' | 'fees_amount';
		label: string;
	}> = [
		{query: 'mint_analytics_mints', metric: 'mints_amount', label: 'Mints'},
		{query: 'mint_analytics_melts', metric: 'melts_amount', label: 'Melts'},
		{query: 'mint_analytics_swaps', metric: 'swaps_amount', label: 'Swaps'},
		{query: 'mint_analytics_fees', metric: 'fees_amount', label: 'Fee Revenue'},
	];

	for (const {query, metric, label} of AMOUNT_METRICS) {
		test(`${query} cumulative sum for sat equals daemon-DB ${metric} at the cache ceiling`, async ({page}, testInfo) => {
			const config = getConfig(testInfo.project.name);
			const readiness = await getReadiness(page);
			const last_processed_at = readiness.mint_analytics_recent.reduce((max, row) => Math.max(max, row.date), 0);
			const oracle = mint.metricWindow(config, {metric, unit: 'sat', last_processed_at});
			test.skip(oracle.amount === 0, `no archived ${label.toLowerCase()} sat activity yet on this stack`);

			const raw = await page.evaluate(() => localStorage.getItem('v0.auth.token'));
			const token = raw ? (JSON.parse(raw) as string) : null;
			const headers: Record<string, string> = token ? {Authorization: `Bearer ${token}`} : {};
			const gqlQuery = `query Window($date_start: UnixTimestamp, $date_end: UnixTimestamp) {
				${query}(units: [sat], date_start: $date_start, date_end: $date_end, interval: hour) {
					date unit amount
				}
			}`;
			const response = await page.request.post('/api', {
				headers,
				data: {query: gqlQuery, variables: {date_start: 0, date_end: oracle.window.effective_end}},
			});
			expect(response.ok(), `${query} should respond OK`).toBe(true);
			const body = await response.json();
			expect(body.errors, `${query} should not error`).toBeFalsy();
			const rows = (body.data[query] ?? []) as Array<{date: number; unit: string; amount: string}>;
			const sat_rows = rows.filter((r) => r.unit === 'sat');
			const archive_sum = sat_rows.reduce((acc, r) => acc + parseInt(r.amount, 10), 0);
			expect(
				archive_sum,
				`${label} archive cumulative sat sum should equal daemon DB ${metric} (${oracle.amount}) at ceiling ${oracle.window.effective_end}`,
			).toBe(oracle.amount);
		});
	}

	// Ecash is a count-style chart, not amount-style — assert against
	// `mint.countsWindow` instead of `mint.metricWindow`. The chart renders
	// two stacked datasets per unit: Blind Signatures (from
	// `mint_analytics_promises`) and Proofs (from `mint_analytics_proofs`),
	// both with the resolver's `include_count: true` flag so the wire
	// payload carries `amount=0` rows whose `count` is what the chart
	// reads. Sum of `count` across visible buckets per unit equals the
	// daemon DB row count up to the ceiling.
	test('mint_analytics_promises cumulative sat count equals daemon-DB promise count at the cache ceiling', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const readiness = await getReadiness(page);
		const last_processed_at = readiness.mint_analytics_recent.reduce((max, row) => Math.max(max, row.date), 0);
		const oracle = mint.countsWindow(config, {unit: 'sat', last_processed_at});
		test.skip(oracle.promises === 0, 'no archived promises for sat yet on this stack');

		const raw = await page.evaluate(() => localStorage.getItem('v0.auth.token'));
		const token = raw ? (JSON.parse(raw) as string) : null;
		const headers: Record<string, string> = token ? {Authorization: `Bearer ${token}`} : {};
		// `OrchardMintAnalytics` carries `amount` AND `count` as separate fields
		// (mintanalytics.model.ts:13,19). For count-style metrics the resolver
		// passes `include_count: true` which populates the `count` field; the
		// chart reads `.count` via `getDataKeyedByTimestamp(data, 'count')`
		// (analytics-chart-data.helpers.ts:56). Sum that, not amount.
		const gqlQuery = `query Window($date_start: UnixTimestamp, $date_end: UnixTimestamp) {
			mint_analytics_promises(units: [sat], date_start: $date_start, date_end: $date_end, interval: hour) {
				date unit count
			}
		}`;
		const response = await page.request.post('/api', {
			headers,
			data: {query: gqlQuery, variables: {date_start: 0, date_end: oracle.window.effective_end}},
		});
		expect(response.ok(), 'mint_analytics_promises should respond OK').toBe(true);
		const body = await response.json();
		expect(body.errors, 'mint_analytics_promises should not error').toBeFalsy();
		const rows = (body.data.mint_analytics_promises ?? []) as Array<{date: number; unit: string; count: number}>;
		const sat_rows = rows.filter((r) => r.unit === 'sat');
		const archive_count = sat_rows.reduce((acc, r) => acc + r.count, 0);
		expect(
			archive_count,
			`promises archive cumulative sat count should equal daemon DB promise rows (${oracle.promises}) at ceiling ${oracle.window.effective_end}`,
		).toBe(oracle.promises);
	});

	test('mint_analytics_proofs cumulative sat count equals daemon-DB proof count at the cache ceiling', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const readiness = await getReadiness(page);
		const last_processed_at = readiness.mint_analytics_recent.reduce((max, row) => Math.max(max, row.date), 0);
		const oracle = mint.countsWindow(config, {unit: 'sat', last_processed_at});
		test.skip(oracle.proofs === 0, 'no archived proofs for sat yet on this stack');

		const raw = await page.evaluate(() => localStorage.getItem('v0.auth.token'));
		const token = raw ? (JSON.parse(raw) as string) : null;
		const headers: Record<string, string> = token ? {Authorization: `Bearer ${token}`} : {};
		// Same `count` vs `amount` split as the promises test above.
		const gqlQuery = `query Window($date_start: UnixTimestamp, $date_end: UnixTimestamp) {
			mint_analytics_proofs(units: [sat], date_start: $date_start, date_end: $date_end, interval: hour) {
				date unit count
			}
		}`;
		const response = await page.request.post('/api', {
			headers,
			data: {query: gqlQuery, variables: {date_start: 0, date_end: oracle.window.effective_end}},
		});
		expect(response.ok(), 'mint_analytics_proofs should respond OK').toBe(true);
		const body = await response.json();
		expect(body.errors, 'mint_analytics_proofs should not error').toBeFalsy();
		const rows = (body.data.mint_analytics_proofs ?? []) as Array<{date: number; unit: string; count: number}>;
		const sat_rows = rows.filter((r) => r.unit === 'sat');
		const archive_count = sat_rows.reduce((acc, r) => acc + r.count, 0);
		expect(
			archive_count,
			`proofs archive cumulative sat count should equal daemon DB proof rows (${oracle.proofs}) at ceiling ${oracle.window.effective_end}`,
		).toBe(oracle.proofs);
	});
});

test.describe('mint-subsection-dashboard — lightning analytics pipeline', {tag: '@analytics @lightning'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/mint');
		// Lightning analytics has its own backfill stream and its own readiness
		// gate. Skip cleanly until the LN cache has at least one row, mirroring
		// the mint-side gating pattern.
		await requireReady(page, lightningAnalyticsHasRows);
	});

	test('lightning_analytics_local_balance cumulative msat at the LN cache ceiling agrees in sign and order-of-magnitude with the live local channel balance', async ({
		page,
	}, testInfo) => {
		// Asset-side differential for the Balance Sheet chart's Assets dataset.
		// The chart cumulatively sums per-bucket deltas in msat
		// (lnanalytics.service.ts:32-38: `(channel_opens + invoices_in +
		// forward_fees) − (payments_out + channel_closes)`) and converts the
		// rightmost point to sat for the live-balance correction.
		//
		// What can be asserted exactly here is limited. The mint-side oracles
		// pivot on a daemon-DB SUM that monotonically tracks issued/redeemed
		// rows whose `created_time < ceiling`. LN doesn't have an analogous
		// "balance at time T" view — channel state is current-only on LND/CLN,
		// and the historical balance is only knowable by replaying every
		// htlc/forward/settle event. Cumulative archive sum at ceiling
		// reflects net local balance up through that ceiling, but `ln.local
		// ChannelBalance(config)` reads LIVE state. Any LN activity in the
		// gap between `last_processed_at + 3600` and "now" makes the two
		// diverge — and unlike mint analytics, the gap can be filled by a
		// test sim's stray payment between cache write and assertion.
		//
		// What this test catches: archive returns the wrong unit (sat when
		// it should be msat → 1000× too small), wrong sign (negative net),
		// or returns 0 entirely (backfill stream broken). It does NOT catch
		// drift within the cache→live gap, which is environment timing, not
		// a bug. For tighter fidelity, see the activity-card spec which
		// pivots on a windowed mint-side oracle, or the balance-sheet card
		// spec which asserts the LIVE local channel balance against the
		// rendered text.
		const config = getConfig(testInfo.project.name);
		test.skip(config.ln === false, 'no LN backend on this stack');
		const live_balance_sat = ln.localChannelBalance(config);
		test.skip(live_balance_sat === 0, 'no live LN local channel balance to anchor the differential');

		const readiness = await getReadiness(page);
		const last_processed_at = readiness.lightning_analytics_recent.reduce((max, row) => Math.max(max, row.date), 0);
		const ceiling = last_processed_at + 3600;

		// Same auth+post pattern as the mint-side differentials. Note
		// `lightning_analytics_local_balance` has no `units` arg — the
		// resolver returns one row per (date) with the unit fixed to `msat`
		// (set by the LN backfill insertion path). The chart filters by
		// `unit === 'msat'` client-side; we do the same here.
		const raw = await page.evaluate(() => localStorage.getItem('v0.auth.token'));
		const token = raw ? (JSON.parse(raw) as string) : null;
		const headers: Record<string, string> = token ? {Authorization: `Bearer ${token}`} : {};
		const gqlQuery = `query Window($date_start: UnixTimestamp, $date_end: UnixTimestamp) {
			lightning_analytics_local_balance(date_start: $date_start, date_end: $date_end, interval: hour) {
				date unit amount
			}
		}`;
		const response = await page.request.post('/api', {
			headers,
			data: {query: gqlQuery, variables: {date_start: 0, date_end: ceiling}},
		});
		expect(response.ok(), 'lightning_analytics_local_balance should respond OK').toBe(true);
		const body = await response.json();
		expect(body.errors, 'lightning_analytics_local_balance should not error').toBeFalsy();
		const rows = (body.data.lightning_analytics_local_balance ?? []) as Array<{date: number; unit: string; amount: string}>;
		const msat_rows = rows.filter((r) => r.unit === 'msat');
		const archive_msat = msat_rows.reduce((acc, r) => acc + parseInt(r.amount, 10), 0);
		// Convert to sat the same way `LocalAmountPipe.getConvertedAmount('sat',
		// _)` does for the live-balance correction. Floor matches the chart's
		// integer division at render time.
		const archive_sat = Math.floor(archive_msat / 1000);

		// Sign: positive net flow into our side of the channels. A negative
		// archive_sat with positive live_balance_sat means the backfill
		// metric inversion is wrong (positive/negative metric sets swapped).
		expect(
			archive_sat,
			`LN archive net should be positive when live balance is positive (live=${live_balance_sat}, archive=${archive_sat})`,
		).toBeGreaterThan(0);
		// Order-of-magnitude: archive ≥ 50% of live AND ≤ 200% of live.
		// In-flight activity within that gap is normal; an order-of-magnitude
		// divergence indicates wrong-unit (1000× scale) or wrong-aggregation
		// (e.g. summing both incoming AND outgoing as positives).
		const ratio = archive_sat / live_balance_sat;
		expect(
			ratio,
			`LN archive (${archive_sat} sat) should be within an order of magnitude of live balance (${live_balance_sat} sat) at ceiling ${ceiling}`,
		).toBeGreaterThanOrEqual(0.5);
		expect(
			ratio,
			`LN archive (${archive_sat} sat) should be within an order of magnitude of live balance (${live_balance_sat} sat) at ceiling ${ceiling}`,
		).toBeLessThanOrEqual(2.0);
	});
});
