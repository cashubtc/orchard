/**
 * Feature spec: the AI assistant CHAT flow — the streamed tool-call behavior
 * on `/event` (`orc-event-subsection-log`) plus the reply-only smoke on the
 * mint dashboard (`/mint`).
 *
 * The behavior under test is the assistant's TOOL CALLS, not its prose. On
 * `/event` the `orc-ai-input` box drives a streamed conversation against the
 * `AiAssistant.EventLog` assistant; each streamed tool call arrives on
 * `AiService.tool_calls$` and `EventSubsectionLogComponent.executeAssistantFunction()`
 * maps it to a real filter mutation (`onSectionsChange` / `onResetFilter` / …),
 * which persists to device settings (localStorage `v0.event.log.settings`) and
 * re-runs the `event_logs` query. The differential is therefore:
 *
 *   LLM → tool call → executeAssistantFunction → onSectionsChange →
 *   device-settings persist + loadData → event_logs resolver → the SAME rows a
 *   raw `SELECT COUNT(*) FROM events WHERE section IN (...)` returns.
 *
 * So each mutating test drives the assistant, waits for the applied filter
 * (the `Filters (N)` badge + the paginator total), then asserts that total
 * equals `orchard.eventCount(config, {sections, date_start, date_end})` read
 * straight from Orchard's own `events` table (orchard.db). The paginator total
 * is the UNPAGED result-set size — directly comparable to a SQL COUNT.
 *
 * Reachability: `@ai` runs ONLY on `cln-cdk-postgres` (the sole stack with
 * `ai_enabled=true`), and `@ai` is stripped from every project grep in
 * playwright.config.ts, so these run only via `npm run e2e:test:ai`. The Ollama
 * vendor lives on the host (`host.docker.internal:11434`) and is frequently
 * absent in CI, so every test gates on `requireReady(page, aiIsHealthy)` and
 * skips cleanly rather than hanging on a dead socket. Without a live model no
 * tool call is ever emitted.
 *
 * Cleanup / suite-green: the filter mutations touch DEVICE settings
 * (localStorage), never the `events` table — filtering is a read, so the DB
 * oracle count is invariant across reruns. The one durable side effect is the
 * persisted filter, which would poison the next `/event` visit within the same
 * storageState. Each mutating test pairs its set-filter with an assistant
 * "reset" tool call AND an `afterEach` `removeItem('v0.event.log.settings')`
 * belt-and-suspenders, so the page reloads to its default 30-day / no-filter
 * window on the next run.
 *
 * States this spec deliberately does NOT cover:
 *   - Types / Statuses / ActorIds / DateRange tool calls (`unit-better` — same
 *     executeAssistantFunction branch shape as Sections; the DateRange window
 *     is locale/timezone-dependent and the model may pick any range, so it is
 *     a looser check not worth the flake. Sections is the discrete-enum
 *     representative differential).
 *   - The mint dashboard assistant's page-mutating tools (Nutalytics control) —
 *     only its reply-streaming path is smoked here, mirroring the existing
 *     `mint-subsection-dashboard.spec.ts` `@ai` test.
 *   - Tool-call argument-table interior (`orc-ai-chat-message-toolcall` detail
 *     rows) — Karma covers the argument-row mapping; the LLM's exact arg text
 *     is nondeterministic, so this asserts on the RESULTING UI/DB state.
 */

import {test, expect, type Locator, type Page} from '@playwright/test';
import {DateTime} from 'luxon';

import {getConfig} from '@e2e/helpers/config';
import {orchard, waitForOllamaIdle} from '@e2e/helpers/backend';
import {aiIsHealthy, requireReady} from '@e2e/helpers/ui/readiness';
import type {ConfigInfo} from '@e2e/types/config';

/** localStorage key the event-log component persists its filter/window into
 *  (`LocalStorageService.STORAGE_KEYS.EVENT_LOG_KEY`). Clearing it resets the
 *  page to its default 30-day, no-filter window on the next mount. */
const EVENT_LOG_KEY = 'v0.event.log.settings';

/** Mirror of the component's default window (`getDefaultDateStart/End`),
 *  computed in the stack's device timezone — identical derivation to the
 *  event-subsection-log spec. Our prompts never fire a DateRange tool, so the
 *  applied window stays at this default and the DB oracle can use it. */
function defaultWindow(config: ConfigInfo): {date_start: number; date_end: number} {
	const zone = config.deviceSettings?.timezone ?? 'local';
	const now = DateTime.now().setZone(zone);
	return {
		date_start: Math.floor(now.minus({days: 30}).startOf('day').toSeconds()),
		date_end: Math.floor(now.endOf('day').toSeconds()),
	};
}

/** Total from the paginator's range label ("1 – 51 of 51" → 51) — the only
 *  place the page renders the UNPAGED total, directly comparable to a SQL
 *  COUNT of the same predicate. */
async function paginatorTotal(page: Page): Promise<number> {
	const label = (await page.locator('.mat-mdc-paginator-range-label').textContent()) ?? '';
	const m = label.match(/of\s+(\d+)/);
	expect(m, `paginator range label should match "x – y of N" (got "${label}")`).not.toBeNull();
	return parseInt(m![1], 10);
}

/** Wait for the event-log page to have loaded its first `event_logs` response.
 *  The neutral `table` icon shows exactly while `loading()` is true; the
 *  paginator label reads "0 of 0" until the first response lands — same probe
 *  the event-subsection-log spec uses. */
async function settle(page: Page): Promise<void> {
	await expect(page.locator('orc-event-subsection-log-control')).toBeVisible();
	await expect(page.locator('orc-event-subsection-log-table mat-icon.icon-lg', {hasText: 'table'})).toHaveCount(0);
	await expect(page.locator('.mat-mdc-paginator-range-label')).toHaveText(/of\s+\d+/);
}

/** The assistant prompt box. Nested in `orc-ai-nav`, gated on `ai_enabled()`;
 *  the chat log content lives in the always-DOM mat-sidenav so tool-call /
 *  assistant chips are assertable even while the panel is closed. NOTE: while
 *  a chat is streaming (`active_chat()` true) the textarea is swapped for an
 *  "Executing..." shimmer — so submit the prompt while the box is present, and
 *  wait on the chat-log effect, not on the input, afterward. */
function aiInput(page: Page): Locator {
	return page.locator('orc-ai-input textarea.ai-input');
}

/** Send one prompt to the assistant. `active_chat()` hides the textarea the
 *  instant the stream opens, so fill + Enter must both land before that flip. */
async function askAssistant(page: Page, prompt: string): Promise<void> {
	const input = aiInput(page);
	await expect(input).toBeVisible();
	await input.fill(prompt);
	await input.press('Enter');
}

/** The filter-count badge button on the log control. Its label is
 *  `Filters {{ filter_count() > 0 ? '('+count+')' : '' }}`. */
function filtersBadge(page: Page): Locator {
	return page.locator('orc-event-subsection-log-control button').filter({hasText: /Filters \(\d+\)/});
}

test.describe('ai assistant chat — event log tool calls', {tag: '@ai'}, () => {
	// Budget: the ollama-idle gate (up to 180s while a prior run drains) plus
	// two streamed tool-call round-trips. Generous so a busy-at-start ollama
	// waits rather than fails.
	test.setTimeout(240_000);

	test.beforeEach(async ({page}) => {
		await page.goto('/event', {waitUntil: 'networkidle'});
		await requireReady(page, aiIsHealthy);
		// Wait for ollama to be genuinely idle — a fire-and-forget agent run
		// from an earlier @ai test can still be generating and would starve the
		// assistant here (health != idle). This is the serialization guarantee.
		expect(await waitForOllamaIdle(180_000), 'ollama should be idle before the assistant prompt').toBe(true);
		await settle(page);
	});

	test.afterEach(async ({page}) => {
		// Belt-and-suspenders: even if the reset tool call didn't land (LLM
		// nondeterminism), drop the persisted filter so the next /event visit
		// within this storageState starts from the default window.
		await page.evaluate((key) => localStorage.removeItem(key), EVENT_LOG_KEY);
	});

	test('assistant "filter to MINT section" tool call applies a section filter whose paginator total matches the DB count, then "reset" clears it', async ({
		page,
	}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const {date_start, date_end} = defaultWindow(config);

		// Baseline unfiltered total (the page opens on the default 30-day window,
		// no filter). Cross-check it against a raw window-only COUNT so the
		// "reset" leg has an authoritative target to return to.
		const baseline_total = await paginatorTotal(page);
		const baseline_db = orchard.eventCount(config, {date_start, date_end});
		expect(baseline_total, 'baseline paginator total should equal the DB window count').toBe(baseline_db);

		// ── Forward: ask for MINT-only events ────────────────────────────────
		// Single-intent prompt that maps 1:1 to EVENT_LOG_SECTIONS_UPDATE with
		// sections=['MINT']. The component validates the enum against
		// Object.values(EventLogSection) before applying, so a hallucinated
		// section is silently dropped — assert on the RESULTING UI state.
		await askAssistant(page, 'Filter the event log to show only MINT section events. Do not change the date range.');

		// Assert the tool call's EFFECT, not the chip's visibility — the chat
		// log lives in a closed mat-sidenav (present but hidden), and the
		// authoritative signal is the applied filter surfacing as the (1)
		// badge. Generous timeout for inference + streamed tool execution.
		await expect(filtersBadge(page)).toContainText('Filters (1)', {timeout: 60_000});

		// The paginator total re-derives from the new event_logs response. Once
		// it agrees with the section-scoped DB count, the assistant-driven
		// mutation is proven to have produced the same result set a raw SQL
		// COUNT with `section IN ('MINT')` returns over the same window.
		const mint_db = orchard.eventCount(config, {date_start, date_end, sections: ['MINT']});
		await expect
			.poll(() => paginatorTotal(page), {
				message: `paginator total should equal DB MINT count (${mint_db}) in window`,
				timeout: 15_000,
			})
			.toBe(mint_db);

		// ── Reset: self-reverting leg keeps the suite green ──────────────────
		await askAssistant(page, 'Reset all the event log filters.');

		// The reset tool call clears the filter — the badge disappears once
		// onResetFilter() empties sections/types/statuses/actor_ids.
		await expect(filtersBadge(page)).toHaveCount(0, {timeout: 60_000});

		// Paginator total returns to the unfiltered window count == the baseline.
		await expect
			.poll(() => paginatorTotal(page), {
				message: `paginator total should return to the unfiltered window count (${baseline_db})`,
				timeout: 15_000,
			})
			.toBe(baseline_db);
	});
});

// NOTE: a plain "assistant returns a non-empty reply" smoke is deliberately
// NOT duplicated here — the existing mint-subsection-dashboard.spec.ts @ai
// test already covers reply streaming. Running two back-to-back assistant
// prompts on the single shared ollama starves the second, so this file keeps
// only the unique tool-call→DB differential above.
