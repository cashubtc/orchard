/**
 * AI settings integration — `/settings/app` AI section on the AI-enabled
 * stack (cln-cdk-postgres). Verifies the integration card reflects the
 * persisted AI settings and the live vendor health, and round-trips the
 * Ollama API endpoint through a real per-field save against Orchard's own
 * `settings` table.
 *
 * `@ai`: runs only on cln-cdk-postgres (the sole `ai_enabled` stack) via
 * `npm run e2e:test:ai`. The Ollama vendor lives on the host
 * (`host.docker.internal:11434`) and can be absent in CI, so every test gates
 * on `requireReady(page, aiIsHealthy)` and skips cleanly rather than hanging.
 *
 * Differential: the health status the card renders ("Connected") must agree
 * with the `ai_health` query the readiness probe reads, and the persisted
 * `settings` rows (ai.enabled / ai.vendor / ai.ollama.api) must match both
 * `config.appSettings` and the rendered controls.
 *
 * Suite-green: the only mutation is the Ollama-API URL, round-tripped within
 * one test (change to a valid variant → assert DB → revert to the exact
 * value settings.setup baked). CRITICAL — never persist ai.enabled=false or
 * a vendor flip: that would break `aiIsHealthy` for every sibling @ai spec
 * on this shared stack. Only the URL is ever written, and it is restored.
 */

import {test, expect, type Locator, type Page} from '@playwright/test';

import {getConfig} from '@e2e/helpers/config';
import {orchard} from '@e2e/helpers/backend';
import {aiIsHealthy, requireReady} from '@e2e/helpers/ui/readiness';

function eventToast(page: Page): Locator {
	return page.locator('orc-event-general-stack orc-event-general-stack-message .event-message-content');
}

function integrationCard(page: Page): Locator {
	return page.locator('orc-settings-subsection-app-ai-integration');
}

/** The Ollama API endpoint input (aria-labelled, inside the Ollama vendor tab). */
function ollamaApiInput(page: Page): Locator {
	return integrationCard(page).locator('input[aria-label="Ollama API Endpoint"]');
}

async function typeInto(field: Locator, value: string): Promise<void> {
	await field.click();
	await field.press('ControlOrMeta+a');
	await field.press('Delete');
	if (value.length > 0) await field.pressSequentially(value, {delay: 0});
}

test.describe('settings app AI integration — /settings/app', {tag: '@ai'}, () => {
	test.describe.configure({mode: 'serial'});

	test.beforeEach(async ({page}) => {
		await page.goto('/settings/app', {waitUntil: 'networkidle'});
		await requireReady(page, aiIsHealthy);
	});

	test('the integration card renders Connected and reflects the persisted AI settings', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const card = integrationCard(page);
		await expect(card).toBeVisible();

		// UI truth: with a reachable Ollama vendor the health block reads
		// "Connected" (health_status() === 'active').
		await expect(card.getByText('Connected', {exact: true})).toBeVisible();

		// Backend truth: the persisted settings match both the stack's matrix
		// and the rendered Ollama endpoint.
		expect(orchard.setting(config, 'ai.enabled')).toBe('true');
		expect(orchard.setting(config, 'ai.vendor')).toBe('ollama');
		const persisted_url = orchard.setting(config, 'ai.ollama.api');
		expect(persisted_url).toBe(config.appSettings?.ai_ollama_api ?? 'http://host.docker.internal:11434');
		await expect(ollamaApiInput(page)).toHaveValue(persisted_url!);
	});

	test('editing the Ollama API endpoint round-trips to the settings table and reverts', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const original = orchard.setting(config, 'ai.ollama.api')!;
		// A still-valid URL variant so OrchardValidators.url passes and the
		// per-field save fires; it need not be reachable — we revert before
		// any sibling re-reads health.
		const probe = original.replace(/:\d+$/, ':11439');
		expect(probe).not.toBe(original);

		const input = ollamaApiInput(page);
		await expect(input).toHaveValue(original);

		try {
			await typeInto(input, probe);
			// Per-field save: Enter → submit.emit('ollama_api') → the parent's
			// updateSettings → 'Setting updated!' toast.
			await input.press('Enter');
			await expect(eventToast(page).filter({hasText: 'Setting updated!'})).toBeVisible();

			// Backend truth: the settings row holds the probe URL verbatim.
			expect(orchard.setting(config, 'ai.ollama.api')).toBe(probe);
		} finally {
			// Restore the exact baked value so `aiIsHealthy` holds for siblings.
			if (orchard.setting(config, 'ai.ollama.api') !== original) {
				await typeInto(input, original);
				await input.press('Enter');
				await expect(eventToast(page).filter({hasText: 'Setting updated!'})).toBeVisible();
			}
		}

		expect(orchard.setting(config, 'ai.ollama.api')).toBe(original);
	});
});
