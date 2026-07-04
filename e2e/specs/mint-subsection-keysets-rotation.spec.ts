/**
 * Feature spec: `orc-mint-subsection-keysets` — the REAL keyset rotation
 * round-trip on `/mint/keysets`. This is the durable-mutation companion to
 * the read-only structural spec (`mint-subsection-keysets.spec.ts`), which
 * deliberately opens/closes and validates the rotation form but never
 * confirms a rotation so it can't mutate the shared daemon keyset table.
 * That mutation lives here, isolated in its own file + serial describe.
 *
 * Rotation is NOT a form submit. Clicking the FAB fires `onRotation()` →
 * `initKeysetsRotation()`, which registers a global `EventData{PENDING,
 * message:'Save'}`; the form pre-populates (unit=sat default, ppk = active
 * keyset's fee, 32 powers-of-2 amounts, keyset_v2 per mint impl) and is
 * already valid. Confirming the PENDING chip (`onClick` → `confirmEvent(true)`
 * → parent `onConfirmedEvent()`) fires the `MintRotateKeyset` mutation
 * (`mint_rotate_keyset`, ADMIN/MANAGER), which on the daemon APPENDS a new
 * keyset for the unit and flips the previously-active keyset inactive.
 *
 * Differential against the live mint daemon. The oracle is
 * `mint.keysets(config)` — the same daemon keyset table the Orchard
 * `mint_keysets` query (and thus the rendered table) derives from. The
 * helper is intentionally uncached (rotation adds keysets mid-test), so the
 * AFTER read is fresh without any recache call. We assert a RELATIVE
 * before/after delta, scoped to one unit, never an absolute count:
 *   +1 keyset for the unit; the old active id now inactive; exactly one
 *   active remains; new active index = old + 1; fee preserved.
 * We also assert the mutation hit the wire (`waitForResponse` + `ok()`),
 * so a UI-only state change can't pass.
 *
 * No teardown — a mint cannot un-rotate a keyset, so this is durable drift
 * BY DESIGN. The suite stays green under rerun three ways: (1) relative
 * deltas hold no matter how many prior rotations ran; (2) rotating again is
 * idempotent w.r.t. those invariants; (3) every sibling keyset spec derives
 * its expected counts from `mint.keysets(config)` at runtime, so the extra
 * inactive keyset is tracked by both oracle and UI automatically.
 *
 * States this spec does NOT cover:
 *   - Rotation error (`disruptive` — would need `docker pause` of the mint,
 *     which knocks out sibling specs).
 *   - Editing form fields (unit switch / custom amounts / advanced) — the
 *     structural spec owns the untouched-form validity surface; here we
 *     leave the form pristine so `keyset_v2` stays impl-correct per stack.
 *   - AI rotation assistant (`stack-only` — cln-cdk-postgres via e2e:test:ai).
 */

import {test, expect, type Locator, type Page} from '@playwright/test';

import {getConfig, mintUnitsFor} from '@e2e/helpers/config';
import {mint} from '@e2e/helpers/backend';
import {matchGql} from '@e2e/helpers/ui/gql-intercept';
import type {ConfigInfo, MintUnit} from '@e2e/types/config';

/** Mount the keysets page: wait for the table host and its first data row
 *  so the route's `mint_keysets` resolver has populated the grid. */
async function openKeysetsPage(page: Page): Promise<Locator> {
	const table = page.locator('orc-mint-subsection-keysets-table');
	await expect(table).toBeVisible();
	await expect(table.locator('tr.entity-row').first()).toBeVisible();
	return table;
}

/** The desktop rotation FAB (`.orc-flat-fab` inside `.mint-keyset-control`).
 *  Only one of the desktop/mobile buttons renders per viewport (`@if
 *  device_type`); `:visible` picks it. Clicking it fires `onRotation()` →
 *  `initKeysetsRotation()`, opening the collapsible and registering the
 *  PENDING 'Save' chip. */
function rotationFab(page: Page): Locator {
	return page.locator('.mint-keyset-control button.orc-flat-fab:visible').first();
}

/** The global event chip — exists twice in the DOM (desktop + mobile nav
 *  slots); `:visible` picks the one for this viewport. The chip is icon-only
 *  outside PENDING; its only text is the PENDING `message` ('Save' here). */
function eventChip(page: Page): Locator {
	return page.locator('orc-event-general-nav-tool:visible').first();
}

/** The toast surface that renders SUCCESS / WARNING / ERROR messages. Each
 *  message is one `orc-event-general-stack-message` whose
 *  `.event-message-content` div carries the text. */
function eventToast(page: Page): Locator {
	return page.locator('orc-event-general-stack orc-event-general-stack-message .event-message-content');
}

/** The active keyset(s) in the rendered table — the `.keyset-active` div lives
 *  inside `orc-mint-general-keyset` in the `mat-column-keyset` cell (inactive
 *  rows render `.keyset-inactive`, per `status_class()`). */
function activeKeysetCells(table: Locator): Locator {
	return table.locator('td.mat-column-keyset .keyset-active');
}

/** Drive one real UI rotation of `unit` and assert the daemon keyset table
 *  mutated exactly as a rotation should. Reads the BEFORE oracle, opens the
 *  form via the FAB (leaving every field untouched so `keyset_v2` stays
 *  impl-correct), confirms the PENDING chip, and asserts the relative delta
 *  against a fresh `mint.keysets` read. Called once per unit by the serial
 *  tests below. */
async function rotateUnitAndAssert(page: Page, config: ConfigInfo, unit: MintUnit): Promise<void> {
	const before = mint.keysets(config).filter((k) => k.unit === unit);
	const before_active = before.filter((k) => k.active);
	expect(before_active.length, `exactly one active ${unit} keyset before rotation`).toBe(1);
	const before_active_id = before_active[0].id;
	const before_active_index = before_active[0].derivation_path_index;
	const before_active_fee = before_active[0].input_fee_ppk;
	const before_count = before.length;

	await openKeysetsPage(page);

	// Always open the rotation form via the FAB (seeds the default unit), then
	// — for a non-default unit — switch the form's Unit select to it. Driving
	// the form's own `mat-select[formControlName="unit"]` is more robust than
	// hunting a per-row Rotate button (`orc-graphic-asset` binds `[unit]` as an
	// Angular input, which does not reflect to a DOM attribute, so it can't be
	// selected on).
	const form = page.locator('orc-mint-subsection-keysets-form');
	const default_unit: MintUnit = mintUnitsFor(config).includes('sat') ? 'sat' : mintUnitsFor(config)[0];
	await rotationFab(page).click();
	await expect(page.locator('.orc-animation-collapsible')).toHaveClass(/animation-open/);
	await expect(form).toBeVisible();
	if (unit !== default_unit) {
		await form.locator('mat-select[formControlName="unit"]').click();
		await page.getByRole('option', {name: unit.toUpperCase(), exact: true}).click();
	}

	// Form is open + valid → the PENDING 'Save' chip is registered.
	await expect(eventChip(page)).toContainText('Save');

	// Confirm via the chip. Register the response waiter BEFORE the click —
	// a fast daemon can answer before a post-click waiter would attach.
	const response = page.waitForResponse(matchGql('MintRotateKeyset'));
	await eventChip(page).locator('.event-nav-tool').click();
	const rotate_response = await response;
	expect(rotate_response.ok()).toBe(true);

	// SUCCESS toast, then the form collapses (onSuccessEvent reloads keysets).
	await expect(eventToast(page).filter({hasText: 'Rotation complete'})).toBeVisible();
	await expect(page.locator('.orc-animation-collapsible')).not.toHaveClass(/animation-open/);

	// PRIMARY oracle: fresh daemon keyset table, filtered to this unit.
	const after = mint.keysets(config).filter((k) => k.unit === unit);
	const after_active = after.filter((k) => k.active);

	expect(after.length, `one new ${unit} keyset appended`).toBe(before_count + 1);
	expect(after_active.length, `exactly one active ${unit} keyset after rotation`).toBe(1);
	expect(after.find((k) => k.id === before_active_id)?.active, 'previously-active keyset flipped inactive').toBe(false);
	expect(after_active[0].id, 'new active keyset is a fresh id').not.toBe(before_active_id);
	expect(after_active[0].derivation_path_index, 'new active index = old + 1').toBe(before_active_index + 1);
	expect(after_active[0].input_fee_ppk, 'rotation preserves the input fee').toBe(before_active_fee);

	// Secondary UI cross-check: the reloaded table re-renders from the fresh
	// `mint_keysets`, so the new generation label must appear. `orc-mint-general-keyset`
	// renders `.mint-keyset-generation` → "Gen {{ derivation_path_index }}", so
	// the rotated unit's new active index surfaces as `Gen ${new_index}`. Assert
	// it renders somewhere in the table (the DB oracle above already proved the
	// per-unit correctness; this confirms the UI reflects that truth).
	const new_index = before_active_index + 1;
	await expect(page.locator('orc-mint-subsection-keysets-table .mint-keyset-generation', {hasText: `Gen ${new_index}`}).first()).toBeVisible();
}

test.describe('mint subsection keysets — real rotation', {tag: '@mint'}, () => {
	test.describe.configure({mode: 'serial'});
	// The keysets page (chart + sortable table) is heavy to mount and the
	// rotation waits on a real daemon mutation; give it room beyond the 30s
	// default when several stacks load mint pages concurrently.
	test.setTimeout(60_000);

	test.beforeEach(async ({page}) => {
		await page.goto('/mint/keysets');
	});

	test('rotating the default (sat) keyset appends one + flips the old active inactive on the daemon', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name.replace(/ \(reader\)$/, '').replace(/:\d+$/, ''));
		const unit: MintUnit = mintUnitsFor(config).includes('sat') ? 'sat' : mintUnitsFor(config)[0];
		await rotateUnitAndAssert(page, config, unit);
	});

	test('rotating a second unit (usd/eur) rotates that unit independently on multi-unit stacks', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name.replace(/ \(reader\)$/, '').replace(/:\d+$/, ''));
		const default_unit: MintUnit = mintUnitsFor(config).includes('sat') ? 'sat' : mintUnitsFor(config)[0];
		const second_unit = mintUnitsFor(config).find((u) => u !== default_unit);
		test.skip(!second_unit, 'stack provisions a single mint unit — no second unit to rotate');
		await rotateUnitAndAssert(page, config, second_unit!);
	});
});
