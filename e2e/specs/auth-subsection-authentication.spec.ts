/**
 * Feature spec: `orc-auth-subsection-authentication` + `orc-auth-subsection-signup`
 * — the logged-out `/auth` and `/auth/signup` pages.
 *
 * Runs in a LOGGED-OUT context (`storageState: empty`) — the suite's baked
 * authed state would change what these routes render. `auth.setup.ts` already
 * covers the real login happy-path and the setup-form validation, so this
 * spec covers page structure and client-side validation WITHOUT submitting
 * real credentials (invalid creds trip the auth throttler; valid creds just
 * duplicate the setup helper).
 *
 * Coverage:
 *   - login form renders (title, Username, Password, Sign up link)
 *   - Login FAB is disabled on the empty form, enabled once filled
 *   - typing a username swaps the logo for a facehash avatar
 *   - Sign up link navigates to /auth/signup
 *   - signup form renders its invite fields
 *
 * NOT covered (see skip taxonomy in the .md):
 *   - real login / signup submit (`disruptive` — setup owns login; signup
 *     needs a real invite + creates a user)
 *   - initialization /auth/setup (`stack-only` — covered by auth.setup.ts)
 *   - route overlay spinner (`unit-better` — transient)
 */

import {test, expect} from '@playwright/test';

import {TEST_ADMIN} from '@e2e/helpers/config';

// Logged-out: drop the baked auth storageState for this whole file.
test.use({storageState: {cookies: [], origins: []}});

test.describe('auth authentication — /auth', {tag: '@all'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/auth', {waitUntil: 'networkidle'});
		// Initialized stacks land on the login form (not /auth/setup).
		await expect(page).toHaveURL(/\/auth$/);
	});

	test('renders the login form', async ({page}) => {
		await expect(page.getByText('Orchard Login')).toBeVisible();
		await expect(page.getByLabel('Username')).toBeVisible();
		await expect(page.getByLabel('Password', {exact: true})).toBeVisible();
		await expect(page.getByRole('link', {name: 'Sign up'})).toBeVisible();
	});

	test('Login button is disabled until the form is valid', async ({page}) => {
		const login = page.getByRole('button', {name: 'Login'});
		await expect(login).toBeDisabled();
		await page.getByLabel('Username').fill(TEST_ADMIN.name);
		await page.getByLabel('Password', {exact: true}).fill(TEST_ADMIN.password);
		await expect(login).toBeEnabled();
	});

	test('typing a username swaps the logo for a facehash avatar', async ({page}) => {
		await expect(page.locator('orc-graphic-orchard-logo')).toBeVisible();
		await page.getByLabel('Username').fill(TEST_ADMIN.name);
		await expect(page.locator('orc-auth-subsection-authentication-form orc-crew-facehash')).toBeVisible();
	});

	test('the Sign up link navigates to the signup form', async ({page}) => {
		await page.getByRole('link', {name: 'Sign up'}).click();
		await expect(page).toHaveURL(/\/auth\/signup$/);
		await expect(page.locator('orc-auth-subsection-signup-form')).toBeVisible();
	});
});

test.describe('auth signup — /auth/signup', {tag: '@all'}, () => {
	test.beforeEach(async ({page}) => {
		// A hard load of /auth/signup redirects to the login form (the SPA
		// auth guard runs after the bundle boots). Reach signup the way a
		// user does — via the login page's Sign up link — so client-side
		// routing keeps the signup render.
		await page.goto('/auth', {waitUntil: 'networkidle'});
		await expect(page).toHaveURL(/\/auth$/);
		await page.getByRole('link', {name: 'Sign up'}).click();
		await expect(page).toHaveURL(/\/auth\/signup$/);
	});

	test('renders the invite signup form fields', async ({page}) => {
		// The signup formcontrols render mat-labels but don't wire the
		// aria-labelledby association the login form does, so getByLabel
		// misses them — assert the visible label text + input count instead.
		const form = page.locator('orc-auth-subsection-signup-form');
		await expect(form).toBeVisible();
		for (const label of ['Invite Key', 'Username', 'Password', 'Confirm Password']) {
			await expect(form.locator('mat-label', {hasText: new RegExp(`^${label}$`)}).first()).toBeVisible();
		}
		await expect(form.locator('input')).toHaveCount(4);
	});
});
