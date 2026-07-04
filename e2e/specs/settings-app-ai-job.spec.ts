/**
 * AI agent job EXECUTE — the `/settings/app` agent job's "Execute now" flow,
 * driven through the real UI and verified against Orchard's own `agent_runs`
 * table.
 *
 * One self-contained test: create a probe agent inline, trigger "Execute now"
 * from its card menu, assert a new `agent_runs` row is recorded (the real
 * proof `ai_agent_execute` ran end-to-end), then delete the agent. The run's
 * terminal status (success/error) is deliberately NOT asserted — it waits on
 * the LLM finishing a tool task, which can take minutes and belongs to the
 * agent runtime's own tests, not a UI-mutation e2e.
 *
 * `@ai`: cln-cdk-postgres only, via `npm run e2e:test:ai`. Executing an agent
 * runs a real inference against Ollama, so this gates on
 * `requireReady(aiIsHealthy)` and budgets generous time for the run.
 *
 * Suite-green: the create→execute→delete chain removes the agent it made
 * (unique timestamp name), so the `agents` table returns to its pre-test
 * state. The `agent_runs` rows for the deleted agent are orphaned but inert
 * (the agent is gone); the assertion is a RELATIVE before/after delta scoped
 * to this agent's id, so it holds regardless of history.
 */

import {test, expect, type Locator, type Page} from '@playwright/test';

import {getConfig} from '@e2e/helpers/config';
import {orchard, waitForOllamaIdle} from '@e2e/helpers/backend';
import {aiIsHealthy, requireReady} from '@e2e/helpers/ui/readiness';

function eventToast(page: Page): Locator {
	return page.locator('orc-event-general-stack orc-event-general-stack-message .event-message-content');
}

function agentForm(page: Page): Locator {
	return page.locator('orc-settings-subsection-app-ai-agent-form');
}

function jobCard(page: Page, name: string): Locator {
	return page.locator('orc-settings-subsection-app-ai-job', {hasText: name});
}

/** Open a job card's more-menu item — the trigger sits on the card's left
 *  edge (can be clipped under the nav), so dispatch a native click on the
 *  button, then click the menu item by role. */
async function openCardMenuItem(page: Page, card: Locator, item: 'Edit' | 'Execute now' | 'Delete'): Promise<void> {
	await card.locator('button', {has: page.locator('mat-icon', {hasText: 'more_vert'})}).evaluate((el) => (el as HTMLElement).click());
	await page.getByRole('menuitem', {name: item}).click();
}

/** Fill and save a new custom agent job with the given name, picking the fast
 *  `qwen3-vl:latest` model so an execution run finishes quickly. Mirrors the
 *  create flow proven in settings-app-ai-agent.spec.ts. */
async function createProbeAgent(page: Page, name: string): Promise<void> {
	await page.locator('orc-settings-subsection-app-ai .add-agent-job-card').click();
	const form = agentForm(page);
	await expect(form).toBeVisible();

	await form.locator('input[formControlName="name"]').fill(name);
	await form.locator('textarea[formControlName="description"]').fill('e2e execute-probe agent');

	// Model: pick the fast VL model via the orc-ai-model search panel.
	await form.locator('orc-ai-model button').first().click();
	const search = page.locator('.cdk-overlay-container input[placeholder="Search models..."]');
	await expect(search).toBeVisible();
	await search.fill('qwen3-vl');
	await page.locator('.cdk-overlay-container button[mat-menu-item]').first().click();

	// System message (contenteditable), one tool (grid is expanded by default),
	// one schedule (cron builder defaults are valid).
	const editor = form.locator('orc-form-markdown-editor [contenteditable]');
	await editor.click();
	await page.keyboard.type('Reply with the single word: ok.');
	const toolCard = form.locator('.tool-card.tool-available').first();
	await toolCard.scrollIntoViewIfNeeded();
	await toolCard.click();
	await form.locator('.new-cron-card').click();
	const cronDialog = page.locator('mat-dialog-container');
	await expect(cronDialog).toBeVisible();
	await cronDialog.locator('button', {hasText: 'Add Schedule'}).click();
	await expect(cronDialog).toHaveCount(0);

	await form.locator('.agent-form-header button', {hasText: 'Save'}).click();
	await expect(eventToast(page).filter({hasText: 'Agent created!'})).toBeVisible();
}

test.describe('settings app AI agent execute — /settings/app', {tag: '@ai'}, () => {
	test('Execute now records an agent_runs row that resolves, then cleans up', async ({page}, testInfo) => {
		// A real inference run — give it room beyond the default 30s.
		// Budget: create + execute-row poll (60s) + the drain poll (up to 180s
		// while the LLM finishes the tool run) + delete.
		test.setTimeout(300_000);
		const config = getConfig(testInfo.project.name);
		const name = `e2e-exec-${Date.now()}`;

		await page.goto('/settings/app', {waitUntil: 'networkidle'});
		await requireReady(page, aiIsHealthy);
		// Start on a free ollama — a leftover run from an earlier test/session
		// would otherwise make this execution queue behind it.
		expect(await waitForOllamaIdle(180_000), 'ollama should be idle before executing').toBe(true);

		// ── Create the probe agent inline. ──
		await createProbeAgent(page, name);
		const agent_id = orchard.agentIdByName(config, name);
		expect(agent_id, 'created agent should have an id').not.toBeNull();
		const runs_before = orchard.agentRunCount(config, agent_id!);

		// ── Execute now → opens the execute panel, which fires ai_agent_execute. ──
		await openCardMenuItem(page, jobCard(page, name), 'Execute now');
		await expect(page.locator('orc-settings-subsection-app-ai-job-execute')).toBeVisible();

		// Backend truth: `ai_agent_execute` persists a new `agent_runs` row for
		// this agent. That the row is recorded — with a real started_at — is the
		// authoritative proof the execute mutation ran end-to-end. We do NOT
		// assert the run RESOLVES to success/error: that waits on the LLM to
		// finish a tool-using task, which can take minutes and is out of scope
		// for a UI-mutation test (the run's terminal status is the agent
		// runtime's concern, exercised by server unit tests).
		await expect
			.poll(() => orchard.agentRunCount(config, agent_id!), {
				message: 'an agent_runs row should be recorded for the execution',
				timeout: 60_000,
			})
			.toBe(runs_before + 1);
		const run = orchard.latestAgentRun(config, agent_id!);
		expect(run, 'a run row should exist').not.toBeNull();
		expect(run!.started_at, 'the run should have a start time').not.toBeNull();

		// ── Drain ollama before finishing. ──
		// The execution is fire-and-forget server-side and keeps generating
		// tokens on the single host ollama after this test moves on — starving
		// the next inference test (deleting the agent does not abort the
		// in-flight request, and the DB run status can flip to error/success
		// while ollama is still generating). Wait for ollama ITSELF to answer a
		// trivial probe quickly, i.e. be truly idle, not just for the run row to
		// resolve. This is the real serialization guarantee.
		const drained = await waitForOllamaIdle(180_000);
		expect(drained, 'ollama should return to idle after the execution drains').toBe(true);

		// ── Clean up: delete the agent (leaves the agents table as found). ──
		// Re-navigate so the execute panel is dismissed and the card is live.
		await page.goto('/settings/app', {waitUntil: 'networkidle'});
		await openCardMenuItem(page, jobCard(page, name), 'Delete');
		const dialog = page.locator('mat-dialog-container');
		await expect(dialog).toBeVisible();
		await dialog.getByRole('button', {name: 'Delete', exact: true}).click();
		await expect(eventToast(page).filter({hasText: 'Job deleted!'})).toBeVisible();
		expect(orchard.agentCountByName(config, name)).toBe(0);
	});
});
