/**
 * Role spec: what the READER role can and cannot do — the server-guard half
 * of RBAC, driven through the real UI under the reader storageState the
 * roles-canary project provisions.
 *
 * Orchard's authorization model (verified against the resolvers): the CLIENT
 * hides nothing — nav, routes, forms and FABs all render for a reader. Every
 * restriction is enforced server-side via `@Roles(UserRole.ADMIN)`:
 *   guarded:   crew_invites (query!), crew_invite_create/update/delete,
 *              crew_user_update/delete (admin-on-other-user), settings_update
 *   unguarded: crew_users query, self-mutations (name/password/telegram —
 *              exercised by crew-user-mutation.reader-admin.spec.ts)
 *
 * So the differentials here assert the GUARD, not the chrome:
 *   1. the reader's /crew renders the full user roster (unguarded query) but
 *      ZERO invite rows even though Orchard's `invites` table holds rows —
 *      the guarded crew_invites query fails and the page falls back to [].
 *   2. an invite create driven to the server comes back an AuthorizationError
 *      (10009), surfaces as an ERROR toast, and writes NOTHING to `invites`.
 *   3. a settings_update (bitcoin-oracle toggle commit) is rejected the same
 *      way and the `settings` row is byte-identical after.
 *
 * Suite-green: rejected mutations mutate nothing by definition — the DB
 * asserts prove exactly that — and localStorage/context state dies with the
 * test. Runs @canary-only like every role spec (roles live in Orchard's own
 * user table, independent of the backend matrix).
 *
 * Deliberately NOT covered:
 *   - reader self-mutations (already covered by
 *     crew-user-mutation.reader-admin.spec.ts, including the admin revert).
 *   - crew_user_update/delete as reader (`unit-better` — same guard class as
 *     the two rejections asserted here; one query + two mutations pin the
 *     mechanism, per-resolver enumeration belongs to server tests).
 */

import {test, expect, type Locator, type Page} from '@playwright/test';

import {getConfig, TEST_ADMIN, TEST_READER} from '@e2e/helpers/config';
import {orchard} from '@e2e/helpers/backend';
import {matchGql} from '@e2e/helpers/ui/gql-intercept';

/** The global event chip — one visible per viewport. */
function eventChip(page: Page): Locator {
	return page.locator('orc-event-general-nav-tool:visible').first();
}

/** Confirm a PENDING event by clicking the chip. */
async function confirmChip(page: Page): Promise<void> {
	await eventChip(page).locator('.event-nav-tool').click();
}

/** SUCCESS / WARNING / ERROR toast surface. */
function eventToast(page: Page): Locator {
	return page.locator('orc-event-general-stack orc-event-general-stack-message .event-message-content');
}

/** Pick a role in the invite form's `mat-select[formControlName="role"]`. */
async function pickRole(page: Page, form: Locator, label: 'Manager' | 'Reader'): Promise<void> {
	await form.locator('mat-select[formControlName="role"]').click();
	const panel = page.locator('.mat-mdc-select-panel').last();
	await expect(panel).toBeVisible();
	await panel.getByRole('option', {name: label, exact: true}).click();
}

test.describe('reader role restrictions — server-side guards through the UI', {tag: '@canary'}, () => {
	test('reader /crew shows the user roster but zero invite rows (guarded crew_invites query)', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name.replace(/ \(reader\)$/, ''));

		await page.goto('/crew');
		const rows = page.locator('orc-index-subsection-crew-table tr.entity-row');
		await expect(rows.first()).toBeVisible();

		// Unguarded roster: both seeded users render.
		await expect(rows.filter({has: page.locator('orc-crew-member-chip', {hasText: TEST_ADMIN.name})})).toHaveCount(1);
		await expect(rows.filter({has: page.locator('orc-crew-member-chip', {hasText: TEST_READER.name})})).toHaveCount(1);

		// The DB truth: invites exist (roles.setup's claimed Reader invite at
		// minimum) — yet the reader's table renders users only, because the
		// guarded crew_invites query failed and the page fell back to [].
		const db_users = orchard.crewUsers(config).length;
		const db_invites = orchard.crewInvites(config).length;
		expect(db_invites, 'the invites table should hold at least the roles.setup invite').toBeGreaterThan(0);
		await expect(rows, 'reader should see exactly the user rows — no invite rows').toHaveCount(db_users);

		// And the admin affordance is NOT client-hidden — the design gates at
		// the server, which the next test proves.
		await expect(page.locator('orc-index-subsection-crew button', {hasText: 'person_add'})).toBeVisible();
	});

	test('invite create as reader is rejected with AuthorizationError and writes nothing', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name.replace(/ \(reader\)$/, ''));
		const PROBE = `e2e-reader-reject-${Date.now()}`;

		await page.goto('/crew');
		await expect(page.locator('orc-index-subsection-crew-table tr.entity-row').first()).toBeVisible();
		const invites_before = orchard.crewInvites(config).length;

		// Same create recipe as the admin CRUD spec: FAB → form → chip confirm.
		await page.locator('orc-index-subsection-crew button', {hasText: 'person_add'}).click();
		const createForm = page.locator(
			'orc-index-subsection-crew > .index-subsection-crew-container > .orc-animation-collapsible orc-index-subsection-crew-form-invite',
		);
		await expect(createForm).toBeVisible();
		await createForm.locator('textarea[formControlName="label"]').fill(PROBE);
		await pickRole(page, createForm, 'Reader');

		const createResp = page.waitForResponse(matchGql('crew_invite_create'));
		await confirmChip(page);
		const body = await (await createResp).json();
		expect(body.errors, 'crew_invite_create should be rejected for a reader').toBeTruthy();

		// The component surfaces the server's getFullError — name + code.
		await expect(eventToast(page).filter({hasText: /AuthorizationError/}).first()).toBeVisible();

		// Backend truth: nothing was written.
		expect(orchard.crewInviteByLabel(config, PROBE), 'no invites row may exist for the probe label').toBeNull();
		expect(orchard.crewInvites(config).length, 'invites count must be unchanged').toBe(invites_before);
	});

	test('settings_update as reader is rejected and the setting row is unchanged', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name.replace(/ \(reader\)$/, ''));

		await page.goto('/settings/app', {waitUntil: 'networkidle'});
		const card = page.locator('orc-settings-subsection-app-bitcoin-oracle');
		await expect(card).toBeVisible();

		// Flip to the opposite of the server's CURRENT value so the toggle
		// actually dirties the form and registers the PENDING commit chip.
		const before = orchard.setting(config, 'bitcoin.oracle');
		const flip_label = before === 'true' ? 'Disabled' : 'Enabled';
		await card.locator('orc-form-toggle').filter({hasText: flip_label}).click();
		await expect(eventChip(page)).toBeVisible();

		const saveResp = page.waitForResponse(matchGql('SettingsUpdate'));
		await confirmChip(page);
		const body = await (await saveResp).json();
		expect(body.errors, 'settings_update should be rejected for a reader').toBeTruthy();

		await expect(eventToast(page).filter({hasText: /AuthorizationError/}).first()).toBeVisible();

		// Backend truth: the settings row is exactly what it was.
		expect(orchard.setting(config, 'bitcoin.oracle'), 'bitcoin.oracle must be unchanged').toBe(before);
	});
});
