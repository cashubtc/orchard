/**
 * Feature spec: `orc-index-subsection-system` — the "System" subsection page
 * at `/system` charting Orchard's own host metrics (CPU, memory, disk, load,
 * V8 heap) plus a system/process uptime stat block.
 *
 * Data source is the `metrics_system` table, written every minute by the
 * `collect-system-metrics` cron (gated on the `system.metrics` setting,
 * default true — so every stack collects out of the box). Host families are
 * stored gauge-style, so a single cron tick populates every chart; the
 * `systemMetricsHasRows` readiness predicate gates data-bearing tests and
 * skips cleanly on a stack whose orchard just booted.
 *
 * Coverage (all `@canary` — the page is config-agnostic; host metrics don't
 * vary with the backend matrix):
 *   - secondary-nav System tab routes to `/system` and mounts the host
 *   - all six chart panels render populated canvases (readiness-gated)
 *   - host info tile row renders five populated tiles (live `system_info`,
 *     independent of the `system.metrics` setting — no readiness gate)
 *   - `system_info` direct probe returns sane host facts
 *   - uptime block shows formatUptime-shaped system + orchard values
 *   - Interval Hour → Minute refires `SystemMetrics` with the new interval
 *   - the refresh button refires `SystemMetrics`
 *
 * States the component supports but this spec does NOT cover:
 *   - empty `bar_chart_off` state (`disruptive` — forcing it means flipping
 *     `system.metrics` off and wiping `metrics_system` mid-run; the mint
 *     system spec's @canary negative covers the shared empty overlay)
 *   - date-range picker interior (`shared-component` —
 *     `orc-form-daterange-scroll-picker` has its own coverage)
 *   - mobile `tune` Filters collapse (`viewport` — projects run desktop)
 *   - chart pixel content / legend values (`unit-better` — Chart.js paints
 *     to canvas; covered by Karma on the chart-data helpers)
 */

import {test, expect, type Page} from '@playwright/test';

import {gql} from '@e2e/helpers/ui/gql';
import {matchGql} from '@e2e/helpers/ui/gql-intercept';
import {requireReady, systemMetricsHasRows} from '@e2e/helpers/ui/readiness';

/** The six chart panels the template renders, by `.title-m` text. */
const CHART_PANELS = ['CPU Usage', 'Memory Usage', 'Memory %', 'Disk Usage', 'Server Load', 'App Memory'] as const;

/** Mount the host. `networkidle` lets the load-time `SystemMetrics` query
 *  settle so later `waitForResponse` waiters can't match the wrong POST. */
async function openSystemPage(page: Page): Promise<void> {
	await page.goto('/system', {waitUntil: 'networkidle'});
	await expect(page.locator('orc-index-subsection-system')).toBeVisible();
}

/** One chart panel's grid cell — the `.col-*` div holding both the
 *  `.title-m` heading and the `orc-system-chart`. */
function chartPanel(page: Page, title: string) {
	return page
		.locator('.index-system-charts > div')
		.filter({has: page.locator('.title-m', {hasText: title})})
		.first();
}

test.describe('index system — /system', {tag: '@canary'}, () => {
	test('secondary-nav System tab routes to /system and mounts the host', async ({page}) => {
		await page.goto('/', {waitUntil: 'networkidle'});
		const tab = page.locator('orc-index-section orc-nav-secondary-item', {hasText: 'System'});
		await expect(tab).toBeVisible();
		await tab.click();
		await expect(page).toHaveURL(/\/system$/);
		const host = page.locator('orc-index-subsection-system');
		await expect(host).toBeVisible();
		await expect(host.locator('orc-system-control')).toBeVisible();
		await expect(host.locator('button[aria-label="Refresh data"]')).toBeVisible();
	});

	test('all six chart panels render populated canvases', async ({page}) => {
		await openSystemPage(page);
		await requireReady(page, systemMetricsHasRows);
		for (const title of CHART_PANELS) {
			const panel = chartPanel(page, title);
			await expect(panel.locator('orc-system-chart canvas'), `${title} canvas`).toBeVisible();
			await expect(panel.locator('.chart-overlay mat-icon', {hasText: 'bar_chart_off'}), `${title} empty overlay`).toHaveCount(0);
		}
	});

	test('host info tile row renders five populated tiles', async ({page}) => {
		await openSystemPage(page);
		const tiles = page.locator('orc-index-system-info .index-system-info-tile');
		await expect(tiles).toHaveCount(5);
		// Shimmer placeholders clear once the live SystemInfo query resolves
		await expect(page.locator('orc-index-system-info .loading-stat-overlay')).toHaveCount(0);
		await expect(tiles.filter({hasText: 'total memory'})).toHaveCount(1);
		await expect(tiles.filter({hasText: 'total disk'})).toHaveCount(1);
		await expect(tiles.filter({hasText: 'operating system'})).toHaveCount(1);
	});

	test('system_info direct probe returns sane host facts', async ({page}) => {
		await openSystemPage(page);
		const data = await gql(
			page,
			'query SystemInfo { system_info { os_platform os_release arch cpu_model cpu_cores memory_total_bytes disk_total_bytes node_version v8_version heap_limit_mb } }',
		);
		const info = data['system_info'] as Record<string, unknown>;
		expect(info['cpu_cores'] as number).toBeGreaterThanOrEqual(1);
		expect((info['os_platform'] as string).length).toBeGreaterThan(0);
		expect((info['node_version'] as string).length).toBeGreaterThan(0);
		expect((info['v8_version'] as string).length).toBeGreaterThan(0);
		expect(info['memory_total_bytes'] as number).toBeGreaterThan(0);
		expect(info['heap_limit_mb'] as number).toBeGreaterThan(0);
	});

	test('uptime block shows formatted system and orchard uptimes', async ({page}) => {
		await openSystemPage(page);
		await requireReady(page, systemMetricsHasRows);
		const values = page.locator('.index-system-uptime-value');
		const captions = page.locator('.index-system-uptime-caption');
		await expect(values).toHaveCount(2);
		await expect(captions.nth(0)).toHaveText('system uptime');
		// The process-uptime stat is captioned "orchard uptime" in the UI.
		await expect(captions.nth(1)).toHaveText('orchard uptime');
		// formatUptime joins the non-zero d/h/m parts (e.g. "13d 8h", "1m"),
		// dropping any zero unit; "—" is the no-data placeholder a real
		// sample must never show.
		for (const value of await values.all()) {
			await expect(value).toHaveText(/^\d+[dhm]( \d+[dhm])*$/);
		}
	});

	test('Interval Hour → Minute refires SystemMetrics with the new interval', async ({page}) => {
		await openSystemPage(page);
		// Default interval is Hour (resolveSystemMetricsSettings); pick Minute
		// and capture the resulting POST carrying the new interval. Waiter is
		// registered before the option click so the response can't be missed.
		const metrics_response = page.waitForResponse(
			(r) => matchGql('SystemMetrics')(r) && (r.request().postData() ?? '').includes('"interval":"minute"'),
		);
		await page.locator('orc-system-control').getByRole('combobox').click();
		await page.getByRole('option', {name: 'Minute', exact: true}).click();
		const body = await (await metrics_response).json();
		expect(body.errors, 'system_metrics should not error').toBeFalsy();
		expect(body.data?.system_metrics, 'system_metrics payload present').toBeDefined();
	});

	test('the refresh button refires SystemMetrics', async ({page}) => {
		await openSystemPage(page);
		const metrics_response = page.waitForResponse(matchGql('SystemMetrics'));
		await page.locator('button[aria-label="Refresh data"]').click();
		const body = await (await metrics_response).json();
		expect(body.errors, 'system_metrics should not error').toBeFalsy();
		await expect(chartPanel(page, 'CPU Usage').locator('orc-system-chart canvas')).toBeVisible();
	});
});
