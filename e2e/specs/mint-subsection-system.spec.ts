/**
 * Feature spec: `orc-mint-subsection-system` — the "System" subsection page
 * at `/mint/system` charting the cdk-mintd prometheus exporter's metric
 * families (process gauges, HTTP/mint/DB counters and histograms).
 *
 * The feature is doubly gated: the mint backend must be cdk AND Orchard must
 * boot with `MINT_METRICS_API` pointing at the exporter
 * (`ApiMintMetricsService.guardSupport`, env config — not a DB setting). The
 * mint section's "System" nav tab is now FIXED — always rendered regardless of
 * config. The route swaps components on match: when `config.mint.metrics` is
 * true (`mintMetricsGuard` canMatch) the real charts component loads; otherwise
 * the route falls through to the `mint-subsection-system-disabled` stub with a
 * docs link. Samples land in `metrics_mint` via the per-minute
 * `collect-mint-metrics` cron; when the scrape endpoint is down the cron
 * warn-logs `Mint metrics endpoint unreachable` (visible via `npm run
 * e2e:logs`) — the diagnostic path if the `[prometheus]` exporter ever drops
 * out of the pinned mintd image.
 *
 * Coverage by tag:
 *   - `@mint-metrics` (lnd-cdk-sqlite only — the stack whose env sets
 *     `MINT_METRICS_API`): nav-tab presence + routing to the real charts
 *     component, gauge-chart population (with a poll on the DB oracle for the
 *     first cron tick), interval and refresh `MintMetrics` refires.
 *   - `@canary` (nutshell + unset env): the System tab is still present, but
 *     both the nav click and a direct `/mint/system` load the not-configured
 *     stub (docs link), never the charts component.
 *
 * States the component supports but this spec does NOT cover:
 *   - counter/histogram charts asserted populated (`warm-up` — counters
 *     need ≥2 scrape ticks AND in-window mint traffic; asserted leniently
 *     as "canvas or empty overlay, never a stuck spinner")
 *   - HTTP Error Rate gauge / Requests Distribution pie values
 *     (`unit-better` — covered by Karma on the chart helpers)
 *   - scrape-outage recovery logging (`disruptive` — `docker pause` on the
 *     mint would knock out sibling specs)
 */

import {test, expect, type Page} from '@playwright/test';

import {getConfig} from '@e2e/helpers/config';
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
	test('mint secondary nav shows the System tab and routes to the charts component', async ({page}) => {
		await page.goto('/mint', {waitUntil: 'networkidle'});
		// The nav is fixed — the System tab always renders. On this stack the
		// exporter is env-configured, so the route matches the real component.
		const tab = page.locator('orc-mint-section orc-nav-secondary-item', {hasText: 'System'});
		await expect(tab).toBeVisible();
		await tab.click();
		await expect(page).toHaveURL(/\/mint\/system$/);
		const host = page.locator('orc-mint-subsection-system');
		await expect(host).toBeVisible();
		await expect(host.locator('orc-system-control')).toBeVisible();
		await expect(host.locator('button[aria-label="Refresh data"]')).toBeVisible();
		// The not-configured stub must NOT render on a metrics-enabled stack.
		await expect(page.locator('orc-mint-subsection-system-disabled')).toHaveCount(0);
	});

	test('gauge charts populate once the scrape cron has sampled', async ({page}, testInfo) => {
		// The cron ticks per minute against the env-configured exporter, so
		// samples normally already exist by the time specs run; the poll is the
		// safety net for the worst case (this file scheduled immediately after
		// the stack boots). Allow three ticks before declaring collection broken.
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

test.describe('mint system disabled — nutshell / unset MINT_METRICS_API', {tag: '@canary'}, () => {
	test('the System tab is present but routes to the not-configured stub', async ({page}) => {
		// Canary runs nutshell with no MINT_METRICS_API, so `config.mint.metrics`
		// is false. The nav is fixed (tab always shown), but the route's
		// mintMetricsGuard canMatch fails and falls through to the stub module.
		await page.goto('/mint', {waitUntil: 'networkidle'});
		const tab = page.locator('orc-mint-section orc-nav-secondary-item', {hasText: 'System'});
		await expect(tab).toBeVisible();
		await tab.click();
		await expect(page).toHaveURL(/\/mint\/system$/);
		const stub = page.locator('orc-mint-subsection-system-disabled');
		await expect(stub).toBeVisible();
		await expect(stub.locator('orc-public-docs-link-card')).toBeVisible();
		// The real charts component must NOT load when the exporter is unset.
		await expect(page.locator('orc-mint-subsection-system')).toHaveCount(0);
	});

	test('direct /mint/system renders the not-configured stub', async ({page}) => {
		await page.goto('/mint/system', {waitUntil: 'networkidle'});
		const stub = page.locator('orc-mint-subsection-system-disabled');
		await expect(stub).toBeVisible();
		await expect(stub.locator('orc-public-docs-link-card')).toBeVisible();
		await expect(page.locator('orc-mint-subsection-system')).toHaveCount(0);
	});
});
