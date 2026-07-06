/**
 * AI custom-agent CRUD — the `/settings/app` AI section's agent jobs, driven
 * through the real form and verified against Orchard's own `agents` table.
 *
 * One serial chain does CREATE → UPDATE → DELETE of a single custom agent
 * (unique probe name). CREATE fills the full job form (name, description,
 * model, system message, one tool, one schedule) and Saves; UPDATE edits the
 * description via the card's Edit menu; DELETE removes it via the card's
 * Delete menu + confirm dialog. Each step reads the authoritative `agents`
 * row (orchard.agent* helpers) and asserts backend truth == what the UI
 * committed.
 *
 * `@ai`: cln-cdk-postgres only (the `ai_enabled` stack) via
 * `npm run e2e:test:ai`. CRUD itself needs no inference — only a model must
 * exist to select — but the AI settings must be enabled for the section to
 * render, so gate on `requireReady(aiIsHealthy)`.
 *
 * Suite-green: the terminal DELETE removes the exact agent created, so the
 * `agents` table returns to its pre-test state (only the built-in
 * GROUNDSKEEPER / ACTIVITY_MONITOR rows remain) and reruns start clean. The
 * probe name is timestamp-unique, so a mid-chain failure that strands an
 * agent never collides with a later run.
 */

import {test, expect, type Locator, type Page} from '@playwright/test';

import {getConfig} from '@e2e/helpers/config';
import {orchard} from '@e2e/helpers/backend';
import {aiIsHealthy, requireReady} from '@e2e/helpers/ui/readiness';

function eventToast(page: Page): Locator {
	return page.locator('orc-event-general-stack orc-event-general-stack-message .event-message-content');
}

/** The agent form (mounted in a FormPanel overlay when a create/edit opens). */
function agentForm(page: Page): Locator {
	return page.locator('orc-settings-subsection-app-ai-agent-form');
}

/** The job card for a named custom agent. */
function jobCard(page: Page, name: string): Locator {
	return page.locator('orc-settings-subsection-app-ai-job', {hasText: name});
}

/** Open a job card's more-menu and click one of its items. The agent-jobs
 *  strip overflows horizontally, so the card's `more_vert` trigger can be
 *  clipped at the nav edge — center the card first so a normal (actionable)
 *  click reaches it, then click the item by its menuitem role. */
async function openCardMenuItem(page: Page, card: Locator, item: 'Edit' | 'Execute now' | 'Delete'): Promise<void> {
	// The trigger sits on the card's left edge and can be clipped under the
	// nav sidebar, so a positional click isn't actionable — dispatch a native
	// DOM click on the button element (fires matMenuTrigger regardless of
	// viewport position). The menu items then render actionably in the overlay.
	await card.locator('button', {has: page.locator('mat-icon', {hasText: 'more_vert'})}).evaluate((el) => (el as HTMLElement).click());
	await page.getByRole('menuitem', {name: item}).click();
}

test.describe('settings app AI agent CRUD — /settings/app', {tag: '@ai'}, () => {
	test.describe.configure({mode: 'serial'});

	const NAME = `e2e-agent-${Date.now()}`;
	const DESC = 'e2e probe agent';
	const DESC_EDITED = 'e2e probe agent (edited)';

	test.beforeEach(async ({page}) => {
		await page.goto('/settings/app', {waitUntil: 'networkidle'});
		await requireReady(page, aiIsHealthy);
	});

	test('CREATE a custom agent through the form and verify the agents row', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		expect(orchard.agentCountByName(config, NAME), 'probe agent must not pre-exist').toBe(0);

		// Open the create form via the "New Agent Job" card.
		await page.locator('orc-settings-subsection-app-ai .add-agent-job-card').click();
		const form = agentForm(page);
		await expect(form).toBeVisible();

		// Name + description.
		await form.locator('input[formControlName="name"]').fill(NAME);
		await form.locator('textarea[formControlName="description"]').fill(DESC);

		// Model: open the orc-ai-model panel and pick the first option.
		await form.locator('orc-ai-model button').first().click();
		const modelOption = page.locator('.cdk-overlay-container button[mat-menu-item]').first();
		await expect(modelOption).toBeVisible();
		await modelOption.click();

		// System message: a contenteditable markdown editor — click + type.
		const editor = form.locator('orc-form-markdown-editor [contenteditable]');
		await editor.click();
		await page.keyboard.type('You are an e2e probe agent. Reply briefly.');

		// Tools: the unused-tools grid is expanded by default, so just add the
		// first available tool (`tools` is a required control — at least one is
		// needed to save). Do NOT click the "Show/Hide unused tools" toggle —
		// it starts expanded, and toggling it would hide the cards.
		const toolCard = form.locator('.tool-card.tool-available').first();
		await toolCard.scrollIntoViewIfNeeded();
		await expect(toolCard).toBeVisible();
		await toolCard.click();

		// Schedule: the cron builder opens with a default; confirm it with the
		// dialog's "Add Schedule" button (`schedules` is required too).
		await form.locator('.new-cron-card').click();
		const cronDialog = page.locator('mat-dialog-container');
		await expect(cronDialog).toBeVisible();
		await cronDialog.locator('button', {hasText: 'Add Schedule'}).click();
		await expect(cronDialog).toHaveCount(0);

		// Save → 'Agent created!' via the global event stack.
		await form.locator('.agent-form-header button', {hasText: 'Save'}).click();
		await expect(eventToast(page).filter({hasText: 'Agent created!'})).toBeVisible();

		// Backend truth: a custom agent row (agent_key NULL) with our name +
		// description now exists.
		const row = orchard.agentByName(config, NAME);
		expect(row, 'agents row should exist after create').not.toBeNull();
		expect(row!.description).toBe(DESC);
		expect(row!.agent_key, 'custom agents have a null agent_key').toBeNull();
		expect(row!.model, 'a model was selected').not.toBeNull();

		// UI truth: the new job card renders.
		await expect(jobCard(page, NAME)).toBeVisible();
	});

	test('UPDATE the agent description and verify the agents row', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		expect(orchard.agentCountByName(config, NAME), 'CREATE must have run first').toBe(1);

		// Open the card's Edit via its more-menu.
		const card = jobCard(page, NAME);
		await expect(card).toBeVisible();
		await openCardMenuItem(page, card, 'Edit');

		const form = agentForm(page);
		await expect(form).toBeVisible();
		const descBox = form.locator('textarea[formControlName="description"]');
		await expect(descBox).toHaveValue(DESC);
		await descBox.fill(DESC_EDITED);

		await form.locator('.agent-form-header button', {hasText: 'Save'}).click();
		await expect(eventToast(page).filter({hasText: 'Agent updated!'})).toBeVisible();

		// Backend truth: description updated, same row.
		expect(orchard.agentByName(config, NAME)?.description).toBe(DESC_EDITED);
	});

	test('DELETE the agent and verify the row is gone', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		expect(orchard.agentCountByName(config, NAME), 'CREATE must have run first').toBe(1);

		const card = jobCard(page, NAME);
		await expect(card).toBeVisible();
		await openCardMenuItem(page, card, 'Delete');

		// Confirm dialog → Delete.
		const dialog = page.locator('mat-dialog-container');
		await expect(dialog).toBeVisible();
		await dialog.getByRole('button', {name: 'Delete', exact: true}).click();
		await expect(eventToast(page).filter({hasText: 'Job deleted!'})).toBeVisible();

		// Backend truth: the agents table no longer holds the row — create→delete
		// leaves it exactly as found.
		expect(orchard.agentCountByName(config, NAME)).toBe(0);
		await expect(jobCard(page, NAME)).toHaveCount(0);
	});
});
