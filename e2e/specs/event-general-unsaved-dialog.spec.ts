/**
 * Feature spec: `orc-event-general-unsaved-dialog` — the route-leave guard
 * surface (`pendingEventGuard`, a CanDeactivate on the settings app/user and
 * mint database routes) that no other spec triggers: they all resolve their
 * PENDING events before navigating.
 *
 * Mechanism under test: dirtying a guarded form registers a PENDING event
 * (`EventService.registerEvent`); navigating away while it's live makes the
 * guard open the dialog. 'Stay on page' closes it returning falsy —
 * navigation cancelled, dirty state intact. 'Leave page' returns true — the
 * guard clears the event (registerEvent(null) after 100ms) and lets the
 * route change through.
 *
 * The probe form is the /settings/user Username field (same input the
 * crew-user-mutation spec drives) — dirtied but NEVER saved, so the spec
 * writes nothing anywhere: no server mutation fires, and the abandoned form
 * state dies with the context. Rerun-green by construction.
 *
 * Runs @canary: the guard + dialog are Orchard chrome, identical on every
 * stack — one stack's coverage is the coverage (same scoping as the role
 * specs).
 */

import {test, expect, type Locator, type Page} from '@playwright/test';

/** Desktop rail item for a section — nav-primary renders one container per
 *  section with the label text inside. */
function railItem(page: Page, label: string): Locator {
	return page.locator('.primary-nav-item-container', {hasText: label});
}

function dialog(page: Page): Locator {
	return page.locator('orc-event-general-unsaved-dialog');
}

test.describe('event unsaved-changes dialog — pendingEventGuard', {tag: '@canary'}, () => {
	test('navigating away from a dirty form opens the dialog; Stay cancels, Leave proceeds', async ({page}) => {
		await page.goto('/settings/user', {waitUntil: 'networkidle'});
		const name_input = page.locator('input[aria-label="Username"]');
		await expect(name_input).toBeVisible();

		// Dirty the field (no save!) — this registers the PENDING event the
		// guard keys on.
		await name_input.fill('unsaved-probe');

		// Attempt to leave via the nav rail → the guard opens the dialog.
		await railItem(page, 'Mint').click();
		await expect(dialog(page)).toBeVisible();
		await expect(dialog(page)).toContainText('You have unsaved changes');

		// Stay: dialog closes, navigation cancelled, dirty value intact.
		await dialog(page).getByRole('button', {name: 'Stay on page'}).click();
		await expect(dialog(page)).toHaveCount(0);
		await expect(page).toHaveURL(/\/settings\/user/);
		await expect(name_input).toHaveValue('unsaved-probe');

		// Leave: dialog closes and the navigation goes through (generous
		// timeout — the target section lazy-loads its chunk before the URL
		// settles).
		await railItem(page, 'Mint').click();
		await expect(dialog(page)).toBeVisible();
		await dialog(page).getByRole('button', {name: 'Leave page'}).click();
		await expect(page).toHaveURL(/\/mint/, {timeout: 15_000});
	});
});
