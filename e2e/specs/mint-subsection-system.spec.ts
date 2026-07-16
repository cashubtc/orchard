/**
 * Feature spec: `orc-mint-subsection-system` — the "System" subsection page
 * at `/mint/system` charting the cdk-mintd prometheus exporter's metric
 * families (process gauges, HTTP/mint/DB counters and histograms).
 *
 * The feature is doubly gated: the mint backend must be cdk AND the
 * `mint.metrics.api` setting must point at the exporter
 * (`ApiMintMetricsService.guardSupport`). The mint section's "System" nav
 * tab renders only when the setting is non-empty (`show_server`,
 * mint-section.component.ts) — computed once at construction, so a fresh
 * page load reflects the settings phase's GraphQL flip. Samples land in
 * `metrics_mint` via the per-minute `collect-mint-metrics` cron; when the
 * scrape endpoint is down the cron warn-logs `Mint metrics endpoint
 * unreachable` (visible via `npm run e2e:logs`) — the diagnostic path if
 * the `[prometheus]` exporter ever drops out of the pinned mintd image.
 *
 * Coverage by tag:
 *   - `@mint-metrics` (lnd-cdk-sqlite only — the stack whose settings
 *     matrix sets `mint_metrics_api`): settings-flip differential against
 *     the orchard DB, nav-tab presence + routing, gauge-chart population
 *     (with a poll on the DB oracle for the first cron tick), interval and
 *     refresh `MintMetrics` refires.
 *   - `@canary` (nutshell + unset setting): the System tab is absent, and
 *     direct `/mint/system` renders every chart in the empty
 *     `bar_chart_off` state without crashing (server MintSupportError
 *     collapses to `metrics=[]` client-side).
 *
 * States the component supports but this spec does NOT cover:
 *   - counter/histogram charts asserted populated (`warm-up` — counters
 *     need ≥2 scrape ticks AND in-window mint traffic; asserted leniently
 *     as "canvas or empty overlay, never a stuck spinner")
 *   - HTTP Error Rate gauge / Requests Distribution pie values
 *     (`unit-better` — covered by Karma on the chart helpers)
 *   - scrape-outage recovery logging (`disruptive` — `docker pause` on the
 *     mint would knock out sibling specs)
 *   - settings UI drive (`next-branch` — no settings card exists yet; see
 *     the TEMPORARY GRAPHQL SHORTCUT note in helpers/ui/settings.ts)
 */

import {test, expect, type Page} from '@playwright/test';

import {CONFIGS, getConfig} from '@e2e/helpers/config';
import {orchard} from '@e2e/helpers/backend';
import {matchGql} from '@e2e/helpers/ui/gql-intercept';

/** Gauge-family panels — cdk exports these as gauges, so one stored scrape
 *  charts them. Counter panels are excluded (see header). */
const GAUGE_PANELS = ['CPU Usage', 'Memory Usage', 'Memory %'] as const;

/** Mount the host. `networkidle` lets the load-time `MintMetrics` query
 *  settle so later `waitForResponse` waiters can't match the wrong POST. */
async function openMintSystemPage(page: Page): Promise<void> {
	await page.goto('/mint/system', {waitUntil: 'networkidle'});
	await expect(page.locator('orc-mint-subsection-system')).toBeVisible();
}

/** One chart panel's grid cell by `.title-m` text. */
function chartPanel(page: Page, title: string) {
	return page
		.locator('.mint-system-charts > div')
		.filter({has: page.locator('.title-m', {hasText: title})})
		.first();
}

test.describe('mint system — /mint/system', {tag: '@mint-metrics'}, () => {
	test('settings phase persisted mint.metrics.api', async ({page: _page}, testInfo) => {
		// Differential against orchard's own settings table: the GraphQL flip
		// in settings.setup must have landed the exact matrix value.
		const config = getConfig(testInfo.project.name);
		expect(orchard.setting(config, 'mint.metrics.api')).toBe(CONFIGS[config.name].appSettings?.mint_metrics_api);
	});

	test('mint secondary nav shows the System tab and routes to /mint/system', async ({page}) => {
		await page.goto('/mint', {waitUntil: 'networkidle'});
		// `show_server` is computed at section construction from the already-
		// flipped setting — this fresh load must render the tab.
		const tab = page.locator('orc-mint-section orc-nav-secondary-item', {hasText: 'System'});
		await expect(tab).toBeVisible();
		await tab.click();
		await expect(page).toHaveURL(/\/mint\/system$/);
		const host = page.locator('orc-mint-subsection-system');
		await expect(host).toBeVisible();
		await expect(host.locator('orc-system-control')).toBeVisible();
		await expect(host.locator('button[aria-label="Refresh data"]')).toBeVisible();
	});

	test('gauge charts populate once the scrape cron has sampled', async ({page}, testInfo) => {
		// The settings phase flips the setting minutes before specs run, so
		// samples normally already exist; the poll is the safety net for the
		// worst case (this file scheduled immediately after settings). Cron
		// ticks per minute — allow three ticks before declaring collection
		// broken.
		test.setTimeout(240_000);
		const config = getConfig(testInfo.project.name);
		await expect.poll(() => orchard.metricsMintCount(config), {timeout: 180_000, intervals: [10_000]}).toBeGreaterThan(0);

		await openMintSystemPage(page);
		for (const title of GAUGE_PANELS) {
			const panel = chartPanel(page, title);
			await expect(panel.locator('orc-system-chart canvas'), `${title} canvas`).toBeVisible();
			await expect(panel.locator('.chart-overlay mat-icon', {hasText: 'bar_chart_off'}), `${title} empty overlay`).toHaveCount(0);
		}
		// Counter/histogram panels may legitimately be empty (they need two
		// scrape ticks plus in-window traffic) — but they must resolve to a
		// canvas or the empty overlay, never a stuck loading spinner.
		const charts = page.locator('orc-system-chart');
		const chart_count = await charts.count();
		for (let i = 0; i < chart_count; i++) {
			await expect(charts.nth(i).locator('.chart-overlay mat-progress-spinner'), `chart ${i} spinner cleared`).toHaveCount(0);
		}
	});

	test('Interval Hour → Minute refires MintMetrics with the new interval', async ({page}) => {
		await openMintSystemPage(page);
		const metrics_response = page.waitForResponse(
			(r) => matchGql('MintMetrics')(r) && (r.request().postData() ?? '').includes('"interval":"minute"'),
		);
		await page.locator('orc-system-control').getByRole('combobox').click();
		await page.getByRole('option', {name: 'Minute', exact: true}).click();
		const body = await (await metrics_response).json();
		expect(body.errors, 'mint_metrics should not error').toBeFalsy();
		expect(body.data?.mint_metrics, 'mint_metrics payload present').toBeDefined();
	});

	test('the refresh button refires MintMetrics', async ({page}) => {
		await openMintSystemPage(page);
		const metrics_response = page.waitForResponse(matchGql('MintMetrics'));
		await page.locator('button[aria-label="Refresh data"]').click();
		const body = await (await metrics_response).json();
		expect(body.errors, 'mint_metrics should not error').toBeFalsy();
	});
});

test.describe('mint system disabled — nutshell / unset setting', {tag: '@canary'}, () => {
	test('the System tab is absent from the mint nav', async ({page}, testInfo) => {
		// Canary runs nutshell and its matrix never sets `mint_metrics_api`,
		// so the server default '' keeps `show_server` false.
		const config = getConfig(testInfo.project.name);
		expect(orchard.setting(config, 'mint.metrics.api')).toBeNull();
		await page.goto('/mint', {waitUntil: 'networkidle'});
		await expect(page.locator('orc-mint-section orc-nav-secondary-item', {hasText: 'Dashboard'})).toBeVisible();
		await expect(page.locator('orc-mint-section orc-nav-secondary-item', {hasText: 'System'})).toHaveCount(0);
	});

	test('direct /mint/system renders every chart in the empty state', async ({page}) => {
		// The route's enabledGuard gates on mint-enabled, not metrics — the
		// page mounts, the query errors server-side (MintSupportError), and
		// the component collapses to empty charts instead of crashing.
		await page.goto('/mint/system', {waitUntil: 'networkidle'});
		const host = page.locator('orc-mint-subsection-system');
		await expect(host).toBeVisible();
		await expect(host.locator('orc-system-control')).toBeVisible();
		// The canvas renders unconditionally (`displayed` defaults true) and
		// sits behind the overlay — the `bar_chart_off` overlay is the
		// empty-state discriminator, not canvas absence.
		const charts = host.locator('orc-system-chart');
		const chart_count = await charts.count();
		expect(chart_count).toBeGreaterThan(0);
		for (let i = 0; i < chart_count; i++) {
			await expect(
				charts.nth(i).locator('.chart-overlay mat-icon', {hasText: 'bar_chart_off'}),
				`chart ${i} empty overlay`,
			).toBeVisible();
		}
	});
});
