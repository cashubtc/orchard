/**
 * Reader-role spec: `/mint/info` as a READER user.
 *
 * Runs in the canary-only `(reader)` project (playwright.config.ts), whose
 * storage state is the READER user provisioned by `setup/roles.setup.ts`
 * through the real crew-invite → signup UI flow.
 *
 * Role enforcement is server-side only today: queries carry no @Roles
 * decorator, mutations require ADMIN/MANAGER (mintinfo.resolver.ts). The
 * client renders every form and save affordance regardless of role, so the
 * reader experience is "see everything, server refuses writes" — these
 * tests pin that contract from both directions:
 *
 *   - read-yes: the page loads and the form reflects daemon NUT-06 truth
 *   - write-no: a per-field save round-trips an AuthorizationError, the
 *     ERROR toast surfaces it, and the daemon value is unchanged
 *
 * When client-side role gating ships (hiding/disabling forms for readers),
 * the write-no test fails loudly and this spec gets rewritten to assert
 * the gated UI instead.
 */

import {test, expect, type Locator, type Page} from '@playwright/test';

import {getConfig} from '@e2e/helpers/config';
import {mint} from '@e2e/helpers/backend';

/** The name field inside the mint-info form — same placeholder-scoped
 *  locator the admin spec uses (Angular doesn't reflect formControlName
 *  to the DOM). */
function nameInput(page: Page): Locator {
	return page.locator('orc-mint-subsection-info-form-name [placeholder="Ex. My Mint"]').first();
}

/** The toast surface for SUCCESS / WARNING / ERROR event messages. */
function eventToast(page: Page): Locator {
	return page.locator('orc-event-general-stack orc-event-general-stack-message .event-message-content');
}

test.describe('mint info as reader — /mint/info', {tag: '@canary'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/mint/info');
	});

	test('reader can load the page and sees daemon truth', async ({page}, testInfo) => {
		// The mint_info query carries no @Roles decorator — any authenticated
		// user reads it. Differential: the name field matches NUT-06.
		const config = getConfig(testInfo.project.name.replace(/ \(reader\)$/, ''));
		const info = mint.getInfo(config);
		await expect(nameInput(page)).toHaveValue(info.name ?? '');
	});

	test('reader save is refused by the server and the daemon is unchanged', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name.replace(/ \(reader\)$/, ''));
		const original = mint.getInfo(config, {fresh: true}).name ?? '';

		// Drive a real per-field save attempt, as a reader would: edit the
		// name, press Enter. The client fires MintNameUpdate; the server's
		// @Roles(ADMIN, MANAGER) guard throws AuthorizationError.
		const input = nameInput(page);
		await input.click();
		await input.press('ControlOrMeta+a');
		await input.pressSequentially('reader-was-here', {delay: 0});
		await input.press('Enter');

		// The rejection surfaces as an ERROR toast (the resolver error's
		// full text includes the AuthorizationError name).
		await expect(eventToast(page).filter({hasText: /authorization/i})).toBeVisible();

		// And the daemon never saw the write.
		expect(mint.getInfo(config, {fresh: true}).name ?? '').toBe(original);
	});
});
