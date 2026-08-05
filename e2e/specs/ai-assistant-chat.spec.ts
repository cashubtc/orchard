/**
 * Feature spec: the AI assistant CHAT flow — the streamed tool-call behavior
 * on `/event` (`orc-event-subsection-log`) plus the reply-only smoke on the
 * mint dashboard (`/mint`).
 *
 * Two describe blocks, with different costs. The first drives real inference
 * and asserts a tool call against the DB. The second asserts the send button's
 * enablement state (`ai_actionable`) and needs NO generation — it submits and
 * immediately aborts. Keep them separate: only the first needs a quiet ollama.
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
 *   - A click-submitted prompt run to COMPLETION — the button-state block
 *     aborts instead. Click and Enter converge on the same `command` output
 *     one hop in, so the completion path is already covered above.
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

/** The send/stop button (`orc-ai-command`), gated by `[disabled]="!actionable()"`.
 *  `ai-nav` renders it in both arms of its `mobile_assistant()` @if, but only
 *  one arm is in the DOM at a time, so this resolves to a single element. */
function commandButton(page: Page): Locator {
	return page.locator('orc-ai-command button');
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

test.describe('ai assistant chat — send button state', {tag: '@ai'}, () => {
	// No inference in this block: `active_subject.next(true)` fires synchronously
	// inside `openAiSocket()`, and the abort leg is one HTTP round-trip. Budget
	// covers page load plus that round-trip, not a generation.
	test.setTimeout(120_000);

	test.beforeEach(async ({page}) => {
		await page.goto('/event', {waitUntil: 'networkidle'});
		// `aiIsHealthy` only — deliberately NO `waitForOllamaIdle`. Nothing here
		// waits on a reply, so a busy model doesn't starve this test; the health
		// gate is still needed because the textarea is `[disabled]="!model()"`
		// and the model only resolves against a reachable vendor.
		await requireReady(page, aiIsHealthy);
		await settle(page);
	});

	test.afterEach(async ({page}) => {
		// The aborted prompt is a greeting, not a filter instruction, so a tool
		// call shouldn't land — but it opens a real socket, so clear the log
		// settings on the same belt-and-suspenders basis as the block above.
		await page.evaluate((key) => localStorage.removeItem(key), EVENT_LOG_KEY);
		// Don't hand the next @ai spec a draining generation. The abort tells
		// the server to stop, but ollama may still be emitting tokens, and the
		// downstream idle gate probes RESPONSIVENESS not exclusivity — with
		// OLLAMA_NUM_PARALLEL > 1 it can read idle while our leftover still
		// competes, slowing an inference assertion that is already tight.
		await waitForOllamaIdle(60_000);
	});

	// REGRESSION: `ai_actionable` was a `computed()` reading `FormControl.value`
	// — a plain property, invisible to the signal graph — so it never
	// recomputed on typing and the send button was permanently disabled. Every
	// other assistant test in the suite submits with `press('Enter')`, which
	// routes straight to the `chat` output and never consults `actionable()`,
	// so a wholly dead button went unnoticed. This drives the button itself.
	test('send button enables on typed content, disables when cleared, and submits on click', async ({page}) => {
		const input = aiInput(page);
		const send = commandButton(page);

		// Empty box → not actionable. (A model must have resolved, or the
		// textarea itself would be disabled and typing would prove nothing.)
		await expect(input).toBeVisible();
		await expect(input).toBeEnabled();
		await expect(send).toBeDisabled();

		// Typing is the differential the regression broke.
		await input.fill('Hello');
		await expect(send).toBeEnabled();

		// ...and it tracks back down, proving the state is live rather than
		// latched true by the first keystroke.
		await input.fill('');
		await expect(send).toBeDisabled();

		// Click (not Enter) submits: `active_chat()` flips on socket open and
		// swaps the textarea for the "Executing..." shimmer.
		await input.fill('Hello');
		await expect(send).toBeEnabled();
		await send.click();
		await expect(page.locator('orc-ai-input .orc-animation-shimmer-text')).toBeVisible();

		// While streaming the same button is the stop control and stays
		// actionable regardless of content (`active_chat()` short-circuits
		// `ai_actionable`). Clicking it aborts and restores the input.
		await expect(send).toBeEnabled();
		await send.click();
		await expect(input).toBeVisible({timeout: 30_000});
		await expect(send).toBeDisabled();
	});
});

// NOTE: a plain "assistant returns a non-empty reply" smoke is deliberately
// NOT duplicated here — the existing mint-subsection-dashboard.spec.ts @ai
// test already covers reply streaming. Running two back-to-back assistant
// prompts on the single shared ollama starves the second, so this file keeps
// only the unique tool-call→DB differential above.
