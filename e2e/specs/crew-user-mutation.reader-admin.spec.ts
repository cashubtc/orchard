/**
 * Mutation spec: real create/update against Orchard's own `users` table,
 * driven through the live UI and verified against the authoritative sqlite
 * store (via `orchard.crewUserByName`), not just against rendered toasts.
 *
 * Two flows, both under admin storageState on the canary stack:
 *
 *   (A) SELF username update (`/settings/user` →
 *       `orc-settings-subsection-user-user-name`). Per-field submit: type a
 *       probe name → Enter fires `crew_user_update_name` → assert the
 *       `users` row for the probe exists, then revert to `admin` and assert
 *       the row is restored. This revert is LOAD-BEARING: `TEST_ADMIN.name`
 *       ('admin') is the credential `auth.setup.ts` logs in with, so a
 *       stranded probe name would brick every later login on this stack. A
 *       `finally` re-reads the DB and force-restores 'admin' if a mid-test
 *       failure left it drifted.
 *
 *   (B) ADMIN edits the READER user's `active` flag (`/crew` →
 *       `orc-index-subsection-crew-form-user`). Relative before/after
 *       differential: read `reader.active` from the DB, flip the slide
 *       toggle, chip-confirm → `crew_user_update` → assert the DB flag
 *       equals the negation, then flip back and assert it equals the
 *       original. `role`/`label` are read alongside and asserted unchanged
 *       to prove the mutation was surgical. Only `active` is ever touched —
 *       never `role` (would break the reader project's role-gated specs;
 *       role=Admin throws server-side) and never a delete (the reader
 *       project's storageState depends on the row).
 *
 * Both flows self-revert within one test, so the suite stays green on
 * rerun and end state is byte-identical to start.
 *
 * States deliberately NOT covered here:
 *   - User/invite CREATE (`disruptive` — no invite-less user creation in
 *     the UI; invite submit mutates shared tables and teardown is fiddly,
 *     see index-subsection-crew.spec.ts).
 *   - User DELETE (`disruptive` — reader row is depended on by the reader
 *     project; admin self-delete is server-guarded).
 *   - role edit / telegram / password (`out-of-scope` — role edit couples
 *     to the reader project; password + telegram have their own surfaces).
 *   - chip CANCEL revert path (covered structurally in mint-subsection-info).
 */

import {test, expect, type Locator, type Page} from '@playwright/test';

import {getConfig, TEST_ADMIN, TEST_READER} from '@e2e/helpers/config';
import {orchard} from '@e2e/helpers/backend';
import {matchGql} from '@e2e/helpers/ui/gql-intercept';
import type {ConfigInfo} from '@e2e/types/config';

/** The canary project name carries a `:port` suffix (getConfig strips it)
 *  and reader projects a ` (reader)` suffix. This spec runs on the admin
 *  project, but normalise defensively so config recovery never depends on
 *  the exact project label. */
function configFor(projectName: string): ConfigInfo {
	return getConfig(projectName.replace(/ \(reader\)$/, '').replace(/:\d+$/, ''));
}

/** The global event chip exists twice in the DOM (desktop + mobile nav
 *  slots); only one is visible per viewport. The chip only shows text in
 *  its PENDING state — every SUCCESS/ERROR message renders in the toast
 *  surface instead (see `eventToast`). */
function eventChip(page: Page): Locator {
	return page.locator('orc-event-general-nav-tool:visible').first();
}

/** Confirm a PENDING event by clicking the chip body. Its `.event-nav-tool`
 *  div emits `save` while `pending_event()` is true, forwarded to
 *  `EventService.confirmEvent(true)`. */
async function confirmChip(page: Page): Promise<void> {
	await eventChip(page).locator('.event-nav-tool').click();
}

/** The toast surface that renders SUCCESS / WARNING / ERROR messages. */
function eventToast(page: Page): Locator {
	return page.locator('orc-event-general-stack orc-event-general-stack-message .event-message-content');
}

/** Drive a Material input cleanly so ReactiveForms sees the `input` event
 *  in the right focus/blur order (bare `fill` occasionally races the
 *  form-field "hot" detection). Click → select-all → delete → type. */
async function typeInto(field: Locator, value: string): Promise<void> {
	await field.click();
	await field.press('ControlOrMeta+a');
	await field.press('Delete');
	if (value.length > 0) await field.pressSequentially(value, {delay: 0});
}

/* *******************************************************
	Flow A — SELF username update (/settings/user)
******************************************************** */

test.describe('crew self-name mutation — /settings/user', {tag: '@canary'}, () => {
	test.describe.configure({mode: 'serial'});

	test.beforeEach(async ({page}) => {
		await page.goto('/settings/user');
	});

	test('username per-field save round-trips to the users table and reverts to admin', async ({page}, testInfo) => {
		const config = configFor(testInfo.project.name);
		const original = TEST_ADMIN.name; // 'admin'
		const probe = `${original}-probe`;

		// Pre-condition: the admin row is at the expected credential name.
		expect(orchard.crewUserByName(config, probe)).toBeNull();
		expect(orchard.crewUserByName(config, original)?.name).toBe(original);

		try {
			const host = page.locator('orc-settings-subsection-user');
			await expect(host).toBeVisible();
			const nameInput = host.locator('orc-settings-subsection-user-user-name input[aria-label="Username"]');
			await expect(nameInput).toHaveValue(original);

			// Edit → the dirty count raises a "1 update" PENDING chip.
			await typeInto(nameInput, probe);
			await expect(eventChip(page)).toContainText(/1 update/);

			// Per-field submit: Enter blurs + emits submit → onSubmitUserName →
			// crew_user_update_name. Register the response waiter BEFORE the
			// Enter — the local resolver answers before a post-action waiter
			// would attach.
			const forward = page.waitForResponse(matchGql('crew_user_update_name'));
			await nameInput.press('Enter');
			await forward;
			await expect(eventToast(page).filter({hasText: 'Username updated'})).toBeVisible();

			// Backend truth: the row is renamed to the probe.
			expect(orchard.crewUserByName(config, probe)?.name).toBe(probe);
			expect(orchard.crewUserByName(config, original)).toBeNull();

			// The input snaps back to the persisted name via crewService.loadUser().
			await expect(nameInput).toHaveValue(probe);

			// Revert probe → admin through the same per-field save.
			await typeInto(nameInput, original);
			await expect(eventChip(page)).toContainText(/1 update/);
			const back = page.waitForResponse(matchGql('crew_user_update_name'));
			await nameInput.press('Enter');
			await back;
			await expect(eventToast(page).filter({hasText: 'Username updated'})).toBeVisible();

			// Backend truth restored.
			expect(orchard.crewUserByName(config, original)?.name).toBe(original);
			expect(orchard.crewUserByName(config, probe)).toBeNull();
		} finally {
			// Safety net: if any assertion above threw while the row was still
			// the probe, restore the login credential directly via the same UI
			// path so downstream logins on this stack aren't bricked. A fresh
			// page avoids inheriting a mid-flight PENDING chip / canDeactivate
			// guard from the failed run.
			if (orchard.crewUserByName(config, original) === null && orchard.crewUserByName(config, probe) !== null) {
				await page.goto('/settings/user');
				const host = page.locator('orc-settings-subsection-user');
				await expect(host).toBeVisible();
				const nameInput = host.locator('orc-settings-subsection-user-user-name input[aria-label="Username"]');
				await typeInto(nameInput, original);
				const restore = page.waitForResponse(matchGql('crew_user_update_name'));
				await nameInput.press('Enter');
				await restore;
				expect(orchard.crewUserByName(config, original)?.name).toBe(original);
			}
		}
	});
});

/* *******************************************************
	Flow B — ADMIN edits READER active (/crew)
******************************************************** */

test.describe('crew admin edits reader — /crew', {tag: '@canary'}, () => {
	test.describe.configure({mode: 'serial'});

	test.beforeEach(async ({page}) => {
		await page.goto('/crew');
	});

	/** Locate the reader row fresh, expand it, and open its edit form. The
	 *  parent clears caches + reloads crew data after every SUCCESS, which
	 *  detaches the previously-expanded row — so callers must re-run this
	 *  from scratch before each edit leg rather than reusing a stale row. */
	async function openReaderEditForm(page: Page): Promise<Locator> {
		await expect(page.locator('orc-index-subsection-crew-table tr.entity-row').first()).toBeVisible();
		// Scope to the reader USER row via its crew-member-chip — invite rows
		// with role READER render a `pending` icon block, not a member chip,
		// so `hasText: 'reader'` alone would also match those (including
		// stray READER-role invites) and break the count.
		const readerRow = page
			.locator('orc-index-subsection-crew-table tr.entity-row')
			.filter({has: page.locator('orc-crew-member-chip', {hasText: TEST_READER.name})});
		await expect(readerRow).toHaveCount(1);

		// Expand the row → VIEW_USER detail (renders the "Edit user" button,
		// gated on !is_admin && !is_self, which holds for the reader).
		await readerRow.click();
		const detail = page.locator('orc-index-subsection-crew-table-user');
		await expect(detail).toBeVisible();
		await detail.locator('button', {hasText: 'Edit user'}).click();

		const form = page.locator('orc-index-subsection-crew-form-user');
		await expect(form).toBeVisible();
		return form;
	}

	/** Flip the active slide-toggle, chip-confirm, and wait for the
	 *  crew_user_update round-trip + the SUCCESS toast. */
	async function flipActiveAndSave(page: Page, form: Locator): Promise<void> {
		await form.locator('mat-slide-toggle button[role="switch"]').click();
		// Dirtying the active control raises the crew PENDING chip. The crew
		// message is literally "update" (not "N updates").
		await expect(eventChip(page)).toContainText(/update/);
		const response = page.waitForResponse(matchGql('crew_user_update'));
		await confirmChip(page);
		await response;
		await expect(eventToast(page).filter({hasText: 'User updated'})).toBeVisible();
	}

	test('toggling reader active persists to the users table then reverts, leaving role and label untouched', async ({page}, testInfo) => {
		const config = configFor(testInfo.project.name);

		// Backend truth at start. The reader must already exist (provisioned by
		// roles.setup on canary before the spec phase).
		const before = orchard.crewUserByName(config, TEST_READER.name);
		expect(before, 'reader user must be provisioned on the canary stack').not.toBeNull();
		const original_active = before!.active;
		const original_role = before!.role;
		const original_label = before!.label;

		// ── Forward: flip active. ──
		const form = await openReaderEditForm(page);
		// The toggle reflects the persisted state before we flip it.
		const toggleInput = form.locator('mat-slide-toggle button[role="switch"]');
		await expect(toggleInput).toHaveAttribute('aria-checked', String(original_active));
		await flipActiveAndSave(page, form);

		// Backend truth: active flipped; role + label surgical (unchanged).
		const after = orchard.crewUserByName(config, TEST_READER.name);
		expect(after?.active).toBe(!original_active);
		expect(after?.role).toBe(original_role);
		expect(after?.label).toBe(original_label);

		// ── Revert: flip active back. Re-open from scratch — the SUCCESS
		//    reload detached the prior expanded row. ──
		const form2 = await openReaderEditForm(page);
		await expect(form2.locator('mat-slide-toggle button[role="switch"]')).toHaveAttribute('aria-checked', String(!original_active));
		await flipActiveAndSave(page, form2);

		// Backend truth restored: byte-identical to start.
		const restored = orchard.crewUserByName(config, TEST_READER.name);
		expect(restored?.active).toBe(original_active);
		expect(restored?.role).toBe(original_role);
		expect(restored?.label).toBe(original_label);
	});
});
