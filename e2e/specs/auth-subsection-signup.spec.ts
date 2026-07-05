/**
 * Feature spec: `/auth/signup` NEGATIVE paths — the validation and rejection
 * surfaces the happy path (roles.setup.ts drives invite → signup for real
 * when it provisions the READER) never exercises.
 *
 * The form (`orc-auth-subsection-signup-form`): four controls in DOM order —
 * key (Invite Key, password-type), name (Username), password,
 * password_confirm. The formcontrols don't wire aria labels (see
 * auth-subsection-authentication.md), so this spec fills BY POSITION, same
 * as roles.setup.ts. Client validators: required on all; maxLength(50) on
 * name; minLength(6)/maxLength(100) on password; passwordMatch on confirm.
 * The Sign Up FAB is `[disabled]="form_group().invalid"`. Server errors map
 * back onto controls via `errorControl()`: code 80003 → 'Invalid invite key'
 * on the key control; 10007 → 'Username already exists' on name.
 *
 * Every test runs in a LOGGED-OUT context (`storageState` reset). The form
 * tests reach signup via the login page's "Sign up" link (the common user
 * path); the prefill test deep-links to /auth/signup/:key directly — that
 * route regressed once (boot-time anonymous 10002 → error-interceptor
 * redirect, broken 2026-01-28..2026-07-05) and its test is the pin.
 *
 * Differential: the invalid-key rejection asserts BOTH the surfaced
 * mat-error and that Orchard's `users` table gained no row for the probe
 * name (`orchard.crewUserByName`) — rejected signups write nothing, so the
 * spec is rerun-green by construction.
 *
 * Deliberately NOT covered:
 *   - happy-path signup (roles.setup.ts owns it — a second real signup per
 *     run would grow the crew roster unboundedly).
 *   - duplicate-username (10007): the server validates the invite key first,
 *     so reaching it needs a fresh UNCLAIMED invite — creating one requires
 *     admin state inside a logged-out spec (`unit-better`; the 80003 path
 *     pins the same errorControl mechanism).
 *   - expired-invite rejection (`fixture-only` — needs a time-warped invite).
 *   - the /auth/signup/:key prefill (skipped below until task_3c8d6b42's
 *     deep-link fix lands — the test body is the ready regression pin).
 *
 * Runs @canary: auth/signup lives entirely in Orchard's own user table,
 * independent of the backend matrix — same scoping as the role specs.
 */

import {test, expect, type Locator, type Page} from '@playwright/test';

import {getConfig} from '@e2e/helpers/config';
import {orchard} from '@e2e/helpers/backend';
import {matchGql} from '@e2e/helpers/ui/gql-intercept';

// Pre-auth surface: start every test logged out.
test.use({storageState: {cookies: [], origins: []}});

/** The four unlabeled inputs by DOM position (key, name, password, confirm)
 *  — the same positional recipe roles.setup.ts uses. */
function control(page: Page, index: 0 | 1 | 2 | 3): Locator {
	return page.locator('orc-auth-subsection-signup-form input').nth(index);
}

function submitButton(page: Page): Locator {
	return page.getByRole('button', {name: 'Sign Up'});
}

/** Reach signup via the login page's link — client-side navigation dodges
 *  the deep-link bounce documented in the header. */
async function gotoSignup(page: Page): Promise<void> {
	await page.goto('/auth', {waitUntil: 'networkidle'});
	await page.getByRole('link', {name: 'Sign up'}).click();
	await expect(page.locator('orc-auth-subsection-signup-form')).toBeVisible();
}

test.describe('auth signup — validation + rejection surfaces', {tag: '@canary'}, () => {
	test.beforeEach(async ({page}) => {
		await gotoSignup(page);
	});

	test('client-side validators gate the submit: required, name length, password mismatch', async ({page}) => {
		// Pristine form → invalid → FAB disabled.
		await expect(submitButton(page)).toBeDisabled();

		// Touch key + name empty → 'Required' surfaces.
		await control(page, 0).click();
		await control(page, 1).click();
		await control(page, 2).click();
		await expect(page.getByText('Required').first()).toBeVisible();

		// 51-char username trips maxLength(50) — no native maxlength attr caps
		// the input, so the validator (not the browser) must reject it.
		await control(page, 1).fill('x'.repeat(51));
		await control(page, 2).click();
		await expect(page.getByText('Maximum length is 50 characters')).toBeVisible();

		// Mismatched confirm trips the cross-field passwordMatch validator.
		await control(page, 2).fill('hunter22');
		await control(page, 3).fill('hunter23');
		await control(page, 1).click();
		await expect(page.getByText('Password mismatch')).toBeVisible();

		// Still invalid end-to-end → FAB still disabled.
		await expect(submitButton(page)).toBeDisabled();
	});

	test('an invalid invite key is rejected server-side, surfaces on the key control, and creates no user', async ({
		page,
	}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const PROBE_NAME = `e2e-signup-reject-${Date.now()}`;

		await control(page, 0).fill('e2e-bogus-invite-key');
		await control(page, 1).fill(PROBE_NAME);
		await control(page, 2).fill('hunter22');
		await control(page, 3).fill('hunter22');
		await expect(submitButton(page)).toBeEnabled();

		const signupResp = page.waitForResponse(matchGql('auth_signup'));
		await submitButton(page).click();
		const body = await (await signupResp).json();
		expect(body.errors, 'auth_signup should be rejected for a bogus key').toBeTruthy();

		// errorControl maps 80003 onto the key control's mat-error.
		await expect(page.getByText('Invalid invite key')).toBeVisible();

		// Backend truth: the rejected signup wrote no users row.
		expect(orchard.crewUserByName(config, PROBE_NAME), 'no user may exist for the probe name').toBeNull();
	});

	test('the /auth/signup/:key route param prefills the invite key control (deep-link regression pin)', async ({page}) => {
		// Pins the error-interceptor fix: an anonymous request failing 10002
		// must not redirect to /auth, or this deep link (the real invite-link
		// shape) bounces to the login page before signup mounts.
		await page.goto('/auth/signup/e2e-prefill-token', {waitUntil: 'networkidle'});
		await expect(control(page, 0)).toHaveValue('e2e-prefill-token');
	});
});
