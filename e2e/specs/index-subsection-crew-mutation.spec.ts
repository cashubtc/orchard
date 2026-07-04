/**
 * Mutation spec: `orc-index-subsection-crew` — the `/crew` page's invite
 * CRUD, driven through the real operator UI and verified against Orchard's
 * authoritative `invites` table (the canary's `sqlite-reader` sidecar →
 * `/orchard/orchard.db`, read via `orchard.crewInvite*` helpers).
 *
 * This is the write counterpart to the deliberately read-only
 * `index-subsection-crew.spec.ts` (`@all`). It runs `@canary` (lnd-nutshell-
 * sqlite only): crew invites live entirely in Orchard's own sqlite,
 * independent of the LN/mint/bitcoin backend, so one stack fully covers them
 * — and `@canary` guarantees the ADMIN storageState the invite mutations
 * (`@Roles(UserRole.ADMIN)`) require.
 *
 * Prime directive: each mutation drives the UI (FAB → form → event chip for
 * create/edit; confirm dialog for delete), waits for the specific GraphQL
 * mutation response and the SUCCESS toast, then reads the `invites` row and
 * asserts DB truth == the values the UI committed. Structural table presence
 * (row appears / disappears) is asserted in addition to — never instead of —
 * the DB read.
 *
 * Suite-green by design: ONE ordered test does create → edit-in-place →
 * delete. The terminal DELETE removes the exact row created, so the `invites`
 * table returns to its pre-test state and reruns stay clean. The probe label
 * is timestamp-unique, so even a mid-test failure that skips the delete never
 * collides with a later run's probe, and a stranded probe invite is inert
 * (expires per its 8h default, filtered out of the list once expired). The
 * id captured from the create response keys the UPDATE/DELETE oracle reads,
 * so they survive the label rename. The seed admin and roles.setup's claimed
 * Reader invite (`used_at IS NOT NULL`) are never touched.
 *
 * States this spec does NOT cover:
 *   - Bulk cancel / WARNING 'Invalid invite' paths (validation surfaces —
 *     covered structurally elsewhere; here the form is left valid so saves
 *     actually fire).
 *   - User (not invite) CRUD — separate flow, separate dialog.
 *   - AI tool-call form population (`ai_enabled` is false on canary).
 *   - Create throttle (`@Throttle limit:10` — one create per run is far under).
 */

import {test, expect, type Locator, type Page} from '@playwright/test';

import {getConfig} from '@e2e/helpers/config';
import {orchard} from '@e2e/helpers/backend';
import {matchGql} from '@e2e/helpers/ui/gql-intercept';

/** The global event chip exists twice in the DOM (desktop sidenav + mobile
 *  bottom-nav slot); only one is visible per viewport. Same recipe as
 *  mint-subsection-info.spec.ts / roles.setup.ts. */
function eventChip(page: Page): Locator {
	return page.locator('orc-event-general-nav-tool:visible').first();
}

/** Confirm a PENDING event by clicking the chip's outer `.event-nav-tool`
 *  div — its `onClick` emits `save` while pending → `confirmEvent(true)` →
 *  parent `eventConfirmed()` routes to `createInvite()` (create form open) or
 *  `updateInvite()` (edit form dirty). */
async function confirmChip(page: Page): Promise<void> {
	await eventChip(page).locator('.event-nav-tool').click();
}

/** The toast surface that renders SUCCESS / WARNING / ERROR messages. The
 *  chip itself only ever shows the PENDING message ('Save' / 'update'). */
function eventToast(page: Page): Locator {
	return page.locator('orc-event-general-stack orc-event-general-stack-message .event-message-content');
}

/** Clean drive of a Material text input so ReactiveForms sees the `input`
 *  event in the right focus/blur order. Click → select-all → delete → type. */
async function typeInto(field: Locator, value: string): Promise<void> {
	await field.click();
	await field.press('ControlOrMeta+a');
	await field.press('Delete');
	if (value.length > 0) await field.pressSequentially(value, {delay: 0});
}

/** Pick a role in a `mat-select[formControlName="role"]`. Click the
 *  `<mat-select>` host (Material binds its open handler there, not the inner
 *  trigger div); the panel mounts as `.mat-mdc-select-panel`. */
async function pickRole(page: Page, form: Locator, label: 'Manager' | 'Reader'): Promise<void> {
	await form.locator('mat-select[formControlName="role"]').click();
	const panel = page.locator('.mat-mdc-select-panel').last();
	await expect(panel).toBeVisible();
	await panel.getByRole('option', {name: label, exact: true}).click();
}

/** Locate the invite row by its label text. */
function inviteRow(page: Page, label: string): Locator {
	return page.locator('orc-index-subsection-crew-table tr.entity-row', {hasText: label});
}

test.describe('index-subsection-crew — invite CRUD', {tag: '@canary'}, () => {
	// Ordered: the id/token captured at CREATE flows into UPDATE and DELETE,
	// and the terminal DELETE is the self-revert that keeps reruns green.
	test.describe.configure({mode: 'serial'});

	test('create → edit → delete an invite, verified against Orchard`s invites table', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name.replace(/ \(reader\)$/, '').replace(/:\d+$/, ''));
		// The two labels share the run-unique timestamp but neither is a
		// substring of the other — `hasText` is a substring match, so an
		// `-edited` suffix on PROBE would make "old label gone" unprovable
		// (the edited row would still contain PROBE).
		const stamp = Date.now();
		const PROBE = `e2e-mut-a-${stamp}`;
		const NEW_LABEL = `e2e-mut-b-${stamp}`;

		await page.goto('/crew');
		// The table renders at least the seed admin row on load.
		await expect(page.locator('orc-index-subsection-crew-table tr.entity-row').first()).toBeVisible();

		/* ── CREATE ─────────────────────────────────────────────────────────
		   FAB opens the invite form AND registers a PENDING 'Save' event; fill
		   label + pick Manager; confirm the chip → crew_invite_create. */
		await page.locator('orc-index-subsection-crew button', {hasText: 'person_add'}).click();
		await expect(page.locator('orc-index-subsection-crew .orc-animation-collapsible').first()).toHaveClass(/animation-open/);

		// Scope to the CREATE form (inside the collapsible) so it never matches
		// an EDIT form that mounts later inside the table.
		const createForm = page.locator(
			'orc-index-subsection-crew > .index-subsection-crew-container > .orc-animation-collapsible orc-index-subsection-crew-form-invite',
		);
		await expect(createForm).toBeVisible();
		await createForm.locator('textarea[formControlName="label"]').fill(PROBE);
		await pickRole(page, createForm, 'Manager');

		// The chip shows the PENDING 'Save' message while the create form is open.
		await expect(eventChip(page)).toContainText(/Save/i);

		// Register the response waiter BEFORE confirming — nutshell answers fast
		// enough to resolve before a post-click waiter would attach.
		const createResp = page.waitForResponse(matchGql('crew_invite_create'));
		await confirmChip(page);
		const createBody = await (await createResp).json();
		expect(createBody.errors, 'crew_invite_create should not error').toBeFalsy();

		const id: string = createBody.data.crew_invite_create.id;
		expect(id, 'create response should carry the new invite id').toBeTruthy();

		await expect(eventToast(page).filter({hasText: 'Invite created'})).toBeVisible();

		// Backend truth: exactly one unclaimed invite with the probe label, role
		// MANAGER (compared case-insensitively — DB stores the enum value, the
		// GraphQL wire uses the uppercase name).
		const created = orchard.crewInviteByLabel(config, PROBE);
		expect(created, 'invites row for the probe label should exist').not.toBeNull();
		expect(created!.id).toBe(id);
		expect(created!.role.toLowerCase()).toBe('manager');
		expect(created!.used_at).toBeNull();
		const token = created!.token;
		expect(token, 'invite token should be non-empty').toBeTruthy();

		// UI truth == DB truth: the new row shows the probe label + MANAGER role,
		// and its expanded detail renders the same token the DB holds. The
		// SUCCESS handler prepends + rebuilds the data source, so a click landed
		// right after the toast can hit a detached row — wait for the toast to
		// clear, then re-locate and retry the expand (roles.setup.ts hazard).
		await expect(eventToast(page)).toHaveCount(0);
		const row = inviteRow(page, PROBE);
		await expect(row).toHaveCount(1);
		await expect(row).toContainText(/MANAGER/i);

		const tokenEl = page.locator('orc-index-subsection-crew-table-invite .mega-string').last();
		await expect(async () => {
			await inviteRow(page, PROBE).click();
			await expect(tokenEl).toBeVisible({timeout: 1_500});
		}).toPass({timeout: 15_000});
		expect(((await tokenEl.textContent()) ?? '').trim()).toBe(token);

		/* ── UPDATE ─────────────────────────────────────────────────────────
		   Row Edit action → EDIT_INVITE form mounts in the expanded row; rename
		   the label + flip role Manager→Reader → PENDING 'update'; confirm chip
		   → crew_invite_update. */
		await inviteRow(page, PROBE).locator('button', {hasText: 'edit'}).click();
		const editForm = page.locator('orc-index-subsection-crew-table orc-index-subsection-crew-form-invite');
		await expect(editForm).toBeVisible();

		await typeInto(editForm.locator('textarea[formControlName="label"]'), NEW_LABEL);
		await pickRole(page, editForm, 'Reader');
		await expect(eventChip(page)).toContainText(/update/i);

		const updateResp = page.waitForResponse(matchGql('crew_invite_update'));
		await confirmChip(page);
		const updateBody = await (await updateResp).json();
		expect(updateBody.errors, 'crew_invite_update should not error').toBeFalsy();

		await expect(eventToast(page).filter({hasText: 'Invite updated'})).toBeVisible();

		// Backend truth, keyed on the immutable id (survives the label rename):
		// label renamed, role now READER, token unchanged.
		const updated = orchard.crewInviteById(config, id);
		expect(updated, 'invite row should still exist after update').not.toBeNull();
		expect(updated!.label).toBe(NEW_LABEL);
		expect(updated!.role.toLowerCase()).toBe('reader');
		expect(updated!.token).toBe(token);

		// UI truth in-session (NO reload): the update SUCCESS handler must
		// refetch the crew data. Regression guard — a stale `new_invite` from
		// the create used to re-prepend the old row here instead of reloading.
		await expect(eventToast(page)).toHaveCount(0);
		const editedRow = inviteRow(page, NEW_LABEL);
		await expect(editedRow).toHaveCount(1);
		await expect(editedRow).toContainText(/READER/i);
		await expect(inviteRow(page, PROBE)).toHaveCount(0);

		/* ── DELETE ─────────────────────────────────────────────────────────
		   Row Delete action → confirm dialog (renders the token in bold) →
		   Delete → crew_invite_delete. This is the terminal self-revert. */
		await inviteRow(page, NEW_LABEL).locator('button', {hasText: 'delete_forever'}).click();
		const dialog = page.locator('mat-dialog-container');
		await expect(dialog).toBeVisible();
		await expect(dialog).toContainText(token);

		const deleteResp = page.waitForResponse(matchGql('crew_invite_delete'));
		await dialog.getByRole('button', {name: 'Delete', exact: true}).click();
		const deleteBody = await (await deleteResp).json();
		expect(deleteBody.errors, 'crew_invite_delete should not error').toBeFalsy();

		await expect(eventToast(page).filter({hasText: 'Invite deleted'})).toBeVisible();

		// Backend truth: the row is gone — the create→delete pair leaves the
		// invites table exactly as it was.
		expect(orchard.crewInviteById(config, id), 'invite row should be purged').toBeNull();

		// UI truth in-session (NO reload): the delete SUCCESS refetch removes
		// the row — neither label remains.
		await expect(inviteRow(page, NEW_LABEL)).toHaveCount(0);
		await expect(inviteRow(page, PROBE)).toHaveCount(0);
	});
});
