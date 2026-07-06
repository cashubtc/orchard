/**
 * Feature spec: the AI MESSAGING cards — the operator half
 * (`orc-settings-subsection-app-ai-messaging` on /settings/app, holding the
 * messages.enabled toggle + Telegram bot token) and the per-user half
 * (`orc-settings-subsection-user-messaging` on /settings/user, holding the
 * user's Telegram chat id) — the last untested cards on both settings pages.
 *
 * Both are pure render/gating differentials pivoting on Orchard's own
 * `settings` table (`orchard.setting`):
 *   - the app card mounts inside the AI section unconditionally; its
 *     Telegram tab is DISABLED until the card's messaging toggle
 *     (messages.enabled) is on.
 *   - the user card's disabled-overlay message is a two-stage gate:
 *     'AI currently disabled' when ai.enabled != true, else 'Messaging
 *     currently disabled' when messages.enabled != true, else no overlay.
 *
 * Deliberately NOT covered (all `too-sharp` / `unit-better`):
 *   - flipping messages.enabled or writing a bot token: the token is
 *     ENCRYPTED server-side and enabling messaging with a bogus token wires
 *     a live Telegram vendor — a mid-test failure would leave every sibling
 *     spec's stack chattering at the Telegram API. The settings_update save
 *     mechanics these fields ride are already pinned by the ai-integration
 *     and reader-restriction specs.
 *   - the chat-id save (a crew_user self-mutation — same path the
 *     crew-user-mutation spec pins with the username round-trip).
 */

import {test, expect} from '@playwright/test';

import {getConfig} from '@e2e/helpers/config';
import {orchard} from '@e2e/helpers/backend';

test.describe('ai messaging cards — render + gating differentials', {tag: '@all'}, () => {
	test('the app messaging card renders and its Telegram tab tracks messages.enabled', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const messages_enabled = orchard.setting(config, 'messages.enabled') === 'true';

		await page.goto('/settings/app', {waitUntil: 'networkidle'});
		const card = page.locator('orc-settings-subsection-app-ai-messaging');
		await expect(card).toBeVisible();

		// The Telegram vendor tab is disabled until the card's messaging
		// toggle is on — mirrored straight from the settings table.
		const telegram_tab = card.getByRole('tab', {name: /telegram/i});
		await expect(telegram_tab).toHaveAttribute('aria-disabled', messages_enabled ? 'false' : 'true');
	});

	test('the user messaging card overlay reflects the ai.enabled → messages.enabled gate chain', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const ai_enabled = orchard.setting(config, 'ai.enabled') === 'true';
		const messages_enabled = orchard.setting(config, 'messages.enabled') === 'true';

		await page.goto('/settings/user', {waitUntil: 'networkidle'});
		const card = page.locator('orc-settings-subsection-user-messaging');
		await expect(card).toBeVisible();

		const overlay = card.locator('.disabled-overlay');
		if (!ai_enabled) {
			await expect(overlay).toContainText('AI currently disabled');
		} else if (!messages_enabled) {
			await expect(overlay).toContainText('Messaging currently disabled');
		} else {
			await expect(overlay).toHaveCount(0);
		}
	});
});
