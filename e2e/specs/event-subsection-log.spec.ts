/**
 * Feature spec: `orc-event-subsection-log` — Orchard's audit log at `/event`.
 *
 * The page loads `event_logs` (Orchard's own `events` table) windowed to the
 * last 30 days by default, and renders a filter control, a bubble-timeline
 * chart, an expandable table, and a paginator. Every count assertion pivots
 * on `orchard.eventCount` — the stacks accumulate different event histories
 * from their setup chains, so no test may assume "has events".
 *
 * Window derivation: the component computes start-of-day-30-days-ago →
 * end-of-day-today via luxon, in the DEVICE timezone (settings.setup sets
 * `Settings.defaultZone` per the stack matrix). The oracle mirrors that
 * derivation with the same luxon calls in the same zone.
 *
 * Coverage:
 *   - populated: paginator total == DB count in window; row count ==
 *     min(total, page_size); desktop count label == page row count
 *   - empty via status filter: a status with zero in-window events (picked
 *     from the DB) shows `file_save_off`, unmounts the chart canvas, and
 *     badges the Filters button; Clear all restores
 *   - row expansion: detail row mounts/unmounts on click (rows > 0 only)
 *   - filter menu: 13 enum checkboxes across Status/Section/Type + User
 *     section, Clear all present
 *   - chart pagination: all four arrows disabled when page_count <= 1,
 *     first/prev disabled + next/last enabled on page 0 of multi-page
 *   - mobile viewport: 3 table columns, count label hidden, page-size
 *     select hidden
 *   - section chrome: "Orchard Events" header + orchard/x.y.z version
 *
 * States NOT covered:
 *   - loading (`unit-better` — sub-second transient)
 *   - error (`disruptive` — requires killing Orchard's DB mid-run)
 *   - AI assistant wiring (`stack-only` — cln-cdk-postgres via e2e:test:ai)
 *   - typed date entry (`unit-better` — locale-dependent parsing across the
 *     en-GB / es-ES / de-DE matrix is flaky by design; the preset panel and
 *     blur handlers cover the code path)
 *   - user-chip autocomplete add/remove (`unit-better` here — owned by the
 *     crew spec which controls its own user fixtures)
 */

import {test, expect, type Locator, type Page} from '@playwright/test';
import {DateTime} from 'luxon';

import {getConfig} from '@e2e/helpers/config';
import {orchard} from '@e2e/helpers/backend';
import type {ConfigInfo} from '@e2e/types/config';

const PAGE_SIZE = 100;
const STATUS_OPTIONS = ['ERROR', 'PARTIAL', 'SUCCESS'];

/** Mirror of the component's default window (`getDefaultDateStart/End`),
 *  computed in the stack's device timezone. `'local'` when the matrix
 *  leaves the timezone unset — luxon then uses the host zone, which is
 *  also what the browser context runs in. */
function defaultWindow(config: ConfigInfo): {date_start: number; date_end: number} {
	const zone = config.deviceSettings?.timezone ?? 'local';
	const now = DateTime.now().setZone(zone);
	return {
		date_start: Math.floor(now.minus({days: 30}).startOf('day').toSeconds()),
		date_end: Math.floor(now.endOf('day').toSeconds()),
	};
}

/** Total from the paginator's range label ("1 – 51 of 51" → 51). The label
 *  is the only place the page renders the unpaged total. */
async function paginatorTotal(page: Page): Promise<number> {
	const label = (await page.locator('.mat-mdc-paginator-range-label').textContent()) ?? '';
	const m = label.match(/of\s+(\d+)/);
	expect(m, `paginator range label should match "x – y of N" (got "${label}")`).not.toBeNull();
	return parseInt(m![1], 10);
}

async function settle(page: Page): Promise<void> {
	await expect(page.locator('orc-event-subsection-log-control')).toBeVisible();
	// The paginator label reads "0 of 0" BEFORE the first event_logs
	// response lands, so it can't serve as the settled signal on its own.
	// The table area shows the neutral `table` icon exactly while
	// `loading()` is true — wait for it to clear.
	await expect(page.locator('orc-event-subsection-log-table mat-icon.icon-lg', {hasText: 'table'})).toHaveCount(0);
	await expect(page.locator('.mat-mdc-paginator-range-label')).toHaveText(/of\s+\d+/);
}

async function openFilterMenu(page: Page): Promise<Locator> {
	await page.locator('orc-event-subsection-log-control button', {hasText: 'Filters'}).click();
	const menu = page.locator('.cdk-overlay-container orc-form-filter-menu');
	await expect(menu).toBeVisible();
	return menu;
}

test.describe('event subsection log — /event', {tag: '@all'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/event');
		await settle(page);
	});

	test('section chrome renders the Orchard Events header and version', async ({page}) => {
		const section = page.locator('orc-event-section');
		// Attribute selector: the `.nav-secondary-header` CLASS exists on both
		// the projected div and orc-nav-secondary's own slot wrapper.
		await expect(section.locator('div[nav-secondary-header]')).toHaveText('Orchard Events');
		// `config.mode.version` — assert shape, not the literal, so release
		// bumps don't touch this spec.
		await expect(section.locator('.section-implementation')).toHaveText(/^orchard\/\d+\.\d+\.\d+/);
	});

	test('paginator total matches the events table windowed to the default range', async ({page}, testInfo) => {
		// Differential. Within a stack, spec files run serially on one
		// worker, so no sibling spec is appending events between the page
		// load and the DB read.
		const config = getConfig(testInfo.project.name);
		const ui_total = await paginatorTotal(page);
		const db_total = orchard.eventCount(config, defaultWindow(config));
		expect(ui_total).toBe(db_total);
	});

	test('table renders one row per event up to the page size', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const expected = Math.min(orchard.eventCount(config, defaultWindow(config)), PAGE_SIZE);
		const rows = page.locator('orc-event-subsection-log-table tr.entity-row');
		if (expected === 0) {
			// Empty-log stack: the table renders the file_save_off icon
			// instead of rows. Legitimate on a freshly-reset stack.
			await expect(page.locator('orc-event-subsection-log-table mat-icon.icon-lg')).toHaveText('file_save_off');
		}
		await expect(rows).toHaveCount(expected);
	});

	test('desktop count label shows the current page row count', async ({page}) => {
		// The label counts `data_source.data.length` (page rows), NOT the
		// paginator total — they only agree on single-page results. Assert
		// against the rendered rows so multi-page stacks stay green.
		const rows = await page.locator('orc-event-subsection-log-table tr.entity-row').count();
		// Unanchored regex: getByText regexes run against the raw (not
		// whitespace-normalized) text node, so ^$ anchors never match the
		// template's padded interpolation.
		const label = page.locator('.event-log-control').getByText(/\d+ Events?/);
		await expect(label).toContainText(`${rows} ${rows === 1 ? 'Event' : 'Events'}`);
	});

	test('clicking a row expands its detail panel, clicking again collapses', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		test.skip(orchard.eventCount(config, defaultWindow(config)) === 0, 'no events in window on this stack');
		const first_row = page.locator('orc-event-subsection-log-table tr.entity-row').first();
		await first_row.click();
		await expect(page.locator('orc-event-subsection-log-table-detail')).toBeVisible();
		await expect(page.locator('.more-entity-wrapper-expanded')).toHaveCount(1);
		await first_row.click();
		await expect(page.locator('orc-event-subsection-log-table-detail')).toHaveCount(0);
	});

	test('filter menu lists the full enum surface', async ({page}) => {
		const menu = await openFilterMenu(page);
		// 3 statuses + 6 sections + 4 types = 13 checkboxes, straight from
		// Object.values of the generated enums — a new enum member shows up
		// here as a count bump, which is exactly the regression we want.
		await expect(menu.locator('mat-checkbox')).toHaveCount(13);
		for (const header of ['User', 'Event Status', 'Section', 'Event Type']) {
			await expect(menu.getByText(header, {exact: true})).toBeVisible();
		}
		await expect(menu.getByText('Clear all')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.locator('.cdk-overlay-container orc-form-filter-menu')).toHaveCount(0);
	});

	test('filtering to a zero-event status empties the table and badges the button', async ({page}, testInfo) => {
		// Pick a status with no in-window events from the DB rather than
		// hard-coding ERROR — a stack that logged a real error stays green.
		const config = getConfig(testInfo.project.name);
		const window = defaultWindow(config);
		const empty_status = STATUS_OPTIONS.find((s) => orchard.eventCount(config, {...window, statuses: [s]}) === 0);
		test.skip(empty_status === undefined, 'every status has in-window events on this stack');

		const menu = await openFilterMenu(page);
		await menu.locator('mat-checkbox', {hasText: empty_status!}).locator('input').click();
		await expect(page.locator('orc-event-subsection-log-table mat-icon.icon-lg')).toHaveText('file_save_off');
		await expect(page.locator('orc-event-subsection-log-table tr.entity-row')).toHaveCount(0);
		await expect(page.locator('orc-event-subsection-log-chart canvas')).toHaveCount(0);
		await expect(page.locator('orc-event-subsection-log-control button', {hasText: 'Filters (1)'})).toBeVisible();

		// Clear all restores the unfiltered view (menu stays open).
		await menu.getByText('Clear all').click();
		await expect(page.locator('orc-event-subsection-log-control button', {hasText: /Filters \(\d+\)/})).toHaveCount(0);
	});

	test('chart pagination arrows follow the page count', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const total = orchard.eventCount(config, defaultWindow(config));
		const chart = page.locator('orc-event-subsection-log-chart');
		const arrows = chart.locator('button');
		await expect(arrows).toHaveCount(4);
		if (total <= PAGE_SIZE) {
			// Single page: all four arrows disabled.
			for (let i = 0; i < 4; i++) await expect(arrows.nth(i)).toBeDisabled();
		} else {
			// Page 0 of a multi-page result: back arrows disabled, forward enabled.
			await expect(arrows.nth(0)).toBeDisabled();
			await expect(arrows.nth(1)).toBeDisabled();
			await expect(arrows.nth(2)).toBeEnabled();
			await expect(arrows.nth(3)).toBeEnabled();
		}
	});

	test('chart canvas presence tracks row presence', async ({page}) => {
		const rows = await page.locator('orc-event-subsection-log-table tr.entity-row').count();
		await expect(page.locator('orc-event-subsection-log-chart canvas')).toHaveCount(rows > 0 ? 1 : 0);
	});
});

test.describe('event subsection log — mobile viewport', {tag: '@canary'}, () => {
	test.use({viewport: {width: 375, height: 812}});

	test.beforeEach(async ({page}) => {
		await page.goto('/event');
		await settle(page);
	});

	test('mobile renders 3 columns, hides the count label and page-size select', async ({page}) => {
		// The table only mounts with rows; a freshly-reset canary can have
		// an empty log, in which case there are no header cells to count.
		const rows = await page.locator('orc-event-subsection-log-table tr.entity-row').count();
		await expect(page.locator('orc-event-subsection-log-table th')).toHaveCount(rows > 0 ? 3 : 0);
		await expect(page.locator('.event-log-control').getByText(/\d+ Events?/)).toHaveCount(0);
		await expect(page.locator('.mat-mdc-paginator-page-size')).toHaveCount(0);
	});
});
