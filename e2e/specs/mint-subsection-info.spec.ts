/**
 * Feature spec: `orc-mint-subsection-info` — the "Info" subsection page at
 * `/mint/info` that edits the mint's NUT-06 metadata (name, description,
 * long description, icon URL, contact methods, connection URLs, message
 * of the day) against the live mint daemon.
 *
 * Differential against the live mint daemon. Each test reads the mint's
 * own NUT-06 `/v1/info` via the `mint` helper (docker-execs into the mint
 * container) and asserts the form mirrors that truth — and, for tests
 * that mutate, that the daemon end of the wire actually changed (not just
 * the rendered chip / form state). `mint.getInfo(config, {fresh: true})`
 * busts the worker-process cache after a mutation so the post-save oracle
 * read isn't stale.
 *
 * Mutating tests revert their changes inline before exiting — workers
 * share a stack and other specs read this same daemon's `/v1/info`.
 *
 * Coverage by tag:
 *   - `@canary`: pristine differential (every textbox value matches the
 *     daemon) and a single-field name save round-trip.
 *   - `@mint`: structural assertions (every child mounts; the icon /
 *     MOTD / URL / contact children render in their expected initial
 *     state on the default fixture); per-field save round-trips for the
 *     remaining scalar fields; URL add → save → cleanup; contact add →
 *     save → cleanup with method-select interaction; bulk save via the
 *     event chip; bulk cancel; validation (>200-char name, duplicate
 *     contact methods, empty required URL).
 *
 * States the component supports but this spec does NOT cover:
 *   - Mutation error (`disruptive` — would need `docker pause` of the
 *     mint daemon, which knocks out sibling specs).
 *   - AI tool-call mutation (`unit-better` — needs `ai_enabled=true` and
 *     a live model; the parent's `executeAssistantFunction` is
 *     structurally tested in Karma).
 *   - Icon child `loading` transient state (`unit-better` — 500ms
 *     debounce + 500ms image probe is racy in CI).
 *   - URL `tor` icon (`synthetic` — regtest never produces `.onion`
 *     URLs and the icon is set once in `ngAfterViewInit`).
 *   - `canDeactivate` dialog interior (`dead-branch` — the dialog UI
 *     lives in `event-general-unsaved-dialog`, with its own spec).
 *   - MOTD autogrow geometry (`unit-better` — pixel-fragile).
 */

import {test, expect, type Locator, type Page} from '@playwright/test';

import {getConfig} from '@e2e/helpers/config';
import {mint} from '@e2e/helpers/backend';
import {matchGql} from '@e2e/helpers/ui/gql-intercept';
import type {ConfigInfo} from '@e2e/types/config';

/** Mount the host card. The route resolver pre-loads `mint_info_rpc`, so
 *  the form is populated synchronously in `ngOnInit` — once the host is
 *  visible every child is in its render-ready state. */
async function openInfoPage(page: Page): Promise<Locator> {
	const host = page.locator('orc-mint-subsection-info');
	await expect(host).toBeVisible();
	await expect(host.locator('mat-card-content')).toBeVisible();
	return host;
}

/** The global event chip exists twice in the DOM (desktop sidenav slot +
 *  mobile bottom-nav slot); only one is visible per viewport. Pick the
 *  visible one. The chip itself is icon-only outside of the PENDING state
 *  — the only text it ever shows is the PENDING `message` ("1 update",
 *  "N updates"). All other event messages (Information updated / Invalid
 *  info / Contact method already set / etc.) render in the
 *  `orc-event-general-stack-message` toast surface, NOT the chip. */
function eventChip(page: Page): Locator {
	return page.locator('orc-event-general-nav-tool:visible').first();
}

/** Click the chip to confirm a `PENDING` event. The chip's outer
 *  `.event-nav-tool` div is the click target — the component's `onClick`
 *  emits `save` when `pending_event()` is true, which the nav surface
 *  forwards to `EventService.confirmEvent(true)`. */
async function confirmChip(page: Page): Promise<void> {
	await eventChip(page).locator('.event-nav-tool').click();
}

/** Click the chip's leading mat-icon-button to cancel a `PENDING` event.
 *  The cancel button only renders while `morph_state === 'actionable'`
 *  (PENDING with a message), so the chip must be in that state first. */
async function cancelChip(page: Page): Promise<void> {
	await eventChip(page).locator('button').first().click();
}

/** The toast surface that renders SUCCESS / WARNING / ERROR messages.
 *  Each message is one `orc-event-general-stack-message` whose
 *  `.event-message-content` div carries the text. */
function eventToast(page: Page): Locator {
	return page.locator('orc-event-general-stack orc-event-general-stack-message .event-message-content');
}

/** Drive a Material text input/textarea cleanly so ReactiveForms sees the
 *  `input` event (Playwright's bare `fill` works most of the time but
 *  occasionally lands focus / blur in the wrong order around the
 *  `orc-form-field-dynamic` "hot" detection). Click → select-all → type. */
async function typeInto(field: Locator, value: string): Promise<void> {
	await field.click();
	await field.press('ControlOrMeta+a');
	await field.press('Delete');
	if (value.length > 0) await field.pressSequentially(value, {delay: 0});
}

/** Fire `action` (the save trigger — an Enter press or delete click) and
 *  wait for the round-trip to complete: the GraphQL mutation resolves, then
 *  the SUCCESS toast appears with the parent's "Information updated!" message.
 *  The response waiter is registered *before* `action` runs — a fast daemon
 *  (e.g. nutshell) can answer the mutation before a post-action waiter would
 *  be attached, and the missed response then hangs `waitForResponse`. The
 *  toast auto-clears after 3s — callers that need to start clean for the next
 *  assertion should wait for it to clear via `expectChipIdle` if the next
 *  assertion would race the fade. */
async function expectSuccessAndSettle(page: Page, mutationName: string, action: () => Promise<void>): Promise<void> {
	const response = page.waitForResponse(matchGql(mutationName));
	await action();
	await response;
	await expect(eventToast(page).filter({hasText: 'Information updated'})).toBeVisible();
}

/** Wait for the chip to return to its idle state (icon `save_clock`, no
 *  active event). Use between back-to-back saves so the second save's
 *  `1 update` chip text isn't masked by the first save's lingering
 *  SUCCESS state. */
async function expectChipIdle(page: Page): Promise<void> {
	await expect(eventChip(page).locator('mat-icon').first()).toHaveText('save_clock');
}

/** Locator for one specific child by selector inside the host. */
function child(host: Locator, selector: string): Locator {
	return host.locator(selector);
}

/** Locator for the textbox inside a scalar form-field child (name / icon /
 *  description / description_long / motd). Scope by placeholder — Angular
 *  doesn't reflect `[formControlName]` to a DOM attribute, and the icon
 *  child's `<ng-content>` slot projects the name + description inputs
 *  inside its own subtree, so a naive "first input/textarea" locator
 *  picks the wrong field. Each placeholder is unique across the form. */
function fieldInput(host: Locator, childSelector: string): Locator {
	const placeholder: Record<string, string> = {
		'orc-mint-subsection-info-form-name': 'Ex. My Mint',
		'orc-mint-subsection-info-form-description': 'Ex. Describe your mint',
		'orc-mint-subsection-info-form-description-long': 'Ex. Describe your mint in more detail',
		'orc-mint-subsection-info-form-icon': 'Ex. https://example.com/icon.png',
		'orc-mint-subsection-info-form-motd': 'message displayed to mint members',
	};
	const ph = placeholder[childSelector];
	if (!ph) throw new Error(`fieldInput: unknown child selector ${childSelector}`);
	return child(host, childSelector).locator(`[placeholder="${ph}"]`).first();
}

/** Restore a scalar field's persisted value via a per-field save —
 *  used in cleanup blocks. Caller passes the original daemon value; if
 *  the form already matches it this is a no-op. */
async function revertField(page: Page, host: Locator, childSelector: string, original: string | null): Promise<void> {
	const input = fieldInput(host, childSelector);
	const current = await input.inputValue();
	if (current === (original ?? '')) return;
	await typeInto(input, original ?? '');
	await input.press('Enter');
}

test.describe('mint-subsection-info — pristine differential', {tag: '@canary'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/mint/info');
	});

	test('every textbox value matches the daemon NUT-06 /v1/info', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		const host = await openInfoPage(page);

		await expect(fieldInput(host, 'orc-mint-subsection-info-form-name')).toHaveValue(info.name ?? '');
		await expect(fieldInput(host, 'orc-mint-subsection-info-form-description')).toHaveValue(info.description ?? '');
		await expect(fieldInput(host, 'orc-mint-subsection-info-form-description-long')).toHaveValue(info.description_long ?? '');
		await expect(fieldInput(host, 'orc-mint-subsection-info-form-icon')).toHaveValue(info.icon_url ?? '');
		await expect(fieldInput(host, 'orc-mint-subsection-info-form-motd')).toHaveValue(info.motd ?? '');

		// One URL row per `info.urls` entry; one contact subgroup per `info.contact` entry.
		const urls = info.urls ?? [];
		await expect(host.locator('orc-mint-subsection-info-form-url')).toHaveCount(urls.length);
		for (let i = 0; i < urls.length; i++) {
			await expect(host.locator('orc-mint-subsection-info-form-url').nth(i).locator('input')).toHaveValue(urls[i]);
		}
		const contacts = info.contact ?? [];
		await expect(host.locator('orc-mint-subsection-info-form-contact')).toHaveCount(contacts.length);
		for (let i = 0; i < contacts.length; i++) {
			await expect(host.locator('orc-mint-subsection-info-form-contact').nth(i).locator('input[formControlName="info"]')).toHaveValue(
				contacts[i].info,
			);
		}
	});

	test('per-field name save round-trip persists to the daemon and reverts cleanly', async ({page}, testInfo) => {
		// End-to-end save: edit name → Enter → assert SUCCESS chip + fresh
		// daemon read shows the new value → revert via a second save so the
		// fixture is left clean for sibling specs.
		const config = getConfig(testInfo.project.name);
		const original = mint.getInfo(config).name ?? '';
		const probe = `${original}-probe`;
		const host = await openInfoPage(page);

		const nameInput = fieldInput(host, 'orc-mint-subsection-info-form-name');
		await typeInto(nameInput, probe);
		// `1 update` chip should appear — the dirty count is the structural proof
		// that the form-value subscription wired correctly into EventService.
		await expect(eventChip(page)).toContainText(/1 update/);
		await expectSuccessAndSettle(page, 'mint_name_update', () => nameInput.press('Enter'));

		expect(mint.getInfo(config, {fresh: true}).name).toBe(probe);

		// Revert.
		await typeInto(nameInput, original);
		await expectSuccessAndSettle(page, 'mint_name_update', () => nameInput.press('Enter'));
		expect(mint.getInfo(config, {fresh: true}).name).toBe(original);
	});
});

test.describe('mint-subsection-info — structural', {tag: '@mint'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/mint/info');
	});

	test('every child component mounts exactly once', async ({page}) => {
		const host = await openInfoPage(page);
		await expect(child(host, 'orc-mint-subsection-info-form-name')).toHaveCount(1);
		await expect(child(host, 'orc-mint-subsection-info-form-description')).toHaveCount(1);
		await expect(child(host, 'orc-mint-subsection-info-form-icon')).toHaveCount(1);
		await expect(child(host, 'orc-mint-subsection-info-form-description-long')).toHaveCount(1);
		await expect(child(host, 'orc-mint-subsection-info-form-urls')).toHaveCount(1);
		await expect(child(host, 'orc-mint-subsection-info-form-contacts')).toHaveCount(1);
		await expect(child(host, 'orc-mint-subsection-info-form-motd')).toHaveCount(1);
	});

	test('icon child renders the unset placeholder when the daemon advertises no icon_url', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		test.skip(!!info.icon_url, 'daemon advertises an icon_url — set/loading branches assert in dedicated tests');
		const host = await openInfoPage(page);
		await expect(host.locator('orc-mint-subsection-info-form-icon .mint-info-icon-display.unset-icon')).toBeVisible();
	});

	test('URL row icon reflects the URL scheme', async ({page}, testInfo) => {
		// `getUrlIcon()` runs once in `ngAfterViewInit`: `.onion` → 'tor',
		// starts with 'https' → 'vpn_lock_2', else 'language'. Onion is
		// synthetic-only on regtest; assert https vs language paths from
		// whichever URL the daemon advertises.
		const config = getConfig(testInfo.project.name);
		const urls = mint.getInfo(config).urls ?? [];
		test.skip(urls.length === 0, 'daemon advertises no urls — no row to inspect');

		const host = await openInfoPage(page);
		// Address-type icon is uniquely `.flex-items-center > mat-icon.orc-outline-color`
		// inside the row (the trailing delete-suffix mat-icon is also `orc-outline-color`
		// but lives in a different ancestor flex).
		const icon = host.locator('orc-mint-subsection-info-form-url').first().locator('.flex-items-center > mat-icon.orc-outline-color');
		const expected = urls[0].startsWith('https') ? 'vpn_lock_2' : urls[0].endsWith('.onion') ? 'tor' : 'language';
		if (expected === 'tor') {
			await expect(icon).toHaveAttribute('svgIcon', 'tor');
		} else {
			await expect(icon).toHaveText(expected);
		}
	});

	test('contact row method-select trigger renders the configured method icon + label', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const contacts = mint.getInfo(config).contact ?? [];
		test.skip(contacts.length === 0, 'daemon advertises no contacts — no row to inspect');

		const host = await openInfoPage(page);
		const trigger = host.locator('orc-mint-subsection-info-form-contact').first().locator('mat-select-trigger');

		const expectedLabel: Record<string, string> = {email: 'Email', twitter: 'X', nostr: 'Nostr'};
		const expectedIconType: Record<string, {kind: 'mat' | 'svg'; name: string}> = {
			email: {kind: 'mat', name: 'mail'},
			twitter: {kind: 'svg', name: 'x'},
			nostr: {kind: 'svg', name: 'nostr'},
		};
		const method = contacts[0].method;
		const expected = expectedIconType[method];
		test.skip(!expected, `daemon advertises an unknown contact method "${method}" — only email/twitter/nostr are mapped in the UI`);

		await expect(trigger).toContainText(expectedLabel[method]);
		if (expected.kind === 'svg') {
			await expect(trigger.locator('mat-icon')).toHaveAttribute('svgIcon', expected.name);
		} else {
			await expect(trigger.locator('mat-icon')).toHaveText(expected.name);
		}
	});

	test('MOTD child renders the unset state when the daemon has no motd', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		test.skip(!!mint.getInfo(config).motd, 'daemon advertises a motd — unset branch covered when fixture clears it');
		const host = await openInfoPage(page);
		await expect(host.locator('orc-mint-subsection-info-form-motd .unset-motd')).toBeVisible();
	});

	test('container padding switches from p-2 (desktop) to p-1 on mobile viewport', async ({page}) => {
		const host = await openInfoPage(page);
		await expect(host.locator('.mint-subsection-info-container')).toHaveClass(/p-2/);

		await page.setViewportSize({width: 375, height: 812});
		await expect(host.locator('.mint-subsection-info-container')).toHaveClass(/p-1/);
		// MOTD chat-bubble icon is hidden on mobile via `@if (!device_mobile())`.
		await expect(host.locator('orc-mint-subsection-info-form-motd .message-of-the-day > mat-icon')).toHaveCount(0);

		// Restore for sibling tests in this describe.
		await page.setViewportSize({width: 1280, height: 800});
		await expect(host.locator('.mint-subsection-info-container')).toHaveClass(/p-2/);
	});
});

test.describe('mint-subsection-info — per-field saves', {tag: '@mint'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/mint/info');
	});

	for (const scenario of [
		{label: 'description', child: 'orc-mint-subsection-info-form-description', mutation: 'mint_short_description_update', read: (i: ReturnType<typeof mint.getInfo>) => i.description},
		{label: 'long description', child: 'orc-mint-subsection-info-form-description-long', mutation: 'mint_long_description_update', read: (i: ReturnType<typeof mint.getInfo>) => i.description_long},
		{label: 'motd', child: 'orc-mint-subsection-info-form-motd', mutation: 'mint_motd_update', read: (i: ReturnType<typeof mint.getInfo>) => i.motd},
	] as const) {
		test(`${scenario.label} per-field save round-trips to the daemon`, async ({page}, testInfo) => {
			const config = getConfig(testInfo.project.name);
			const original = scenario.read(mint.getInfo(config)) ?? '';
			const probe = `${original}${original ? ' ' : ''}probe-${scenario.label.replace(/\s+/g, '-')}`;
			const host = await openInfoPage(page);

			const input = fieldInput(host, scenario.child);
			await typeInto(input, probe);
			await expect(eventChip(page)).toContainText(/1 update/);
			await expectSuccessAndSettle(page, scenario.mutation, () => input.press('Enter'));
			expect(scenario.read(mint.getInfo(config, {fresh: true})) ?? '').toBe(probe);

			await expectSuccessAndSettle(page, scenario.mutation, () => revertField(page, host, scenario.child, original || null));
			expect(scenario.read(mint.getInfo(config, {fresh: true})) ?? '').toBe(original);
		});
	}
});

test.describe('mint-subsection-info — array-field saves', {tag: '@mint'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/mint/info');
	});

	test('add a URL → save persists to the daemon → delete reverts', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const before = mint.getInfo(config).urls ?? [];
		const probeUrl = 'https://orc-e2e-probe.example/';
		test.skip(before.includes(probeUrl), 'fixture already has the probe URL — abort to avoid corrupting cleanup');

		const host = await openInfoPage(page);
		await host.getByRole('button', {name: /new url/i}).click();
		const newRow = host.locator('orc-mint-subsection-info-form-url').last();
		await typeInto(newRow.locator('input'), probeUrl);
		await expect(eventChip(page)).toContainText(/1 update/);
		await expectSuccessAndSettle(page, 'mint_url_add', () => newRow.locator('input').press('Enter'));

		// Daemon side: URL list grew by one and includes the probe.
		const after = mint.getInfo(config, {fresh: true}).urls ?? [];
		expect(after).toContain(probeUrl);
		expect(after.length).toBe(before.length + 1);

		// Cleanup: delete the row we just added. The mat-suffix delete button
		// inside the new row triggers `mint_url_remove` directly.
		await expectSuccessAndSettle(page, 'mint_url_remove', () => newRow.locator('button[matSuffix]').click());
		const restored = mint.getInfo(config, {fresh: true}).urls ?? [];
		expect(restored).not.toContain(probeUrl);
		expect(restored.length).toBe(before.length);
	});

	test('add a contact → save persists to the daemon → delete reverts; method auto-picks the next unused option', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const before = mint.getInfo(config).contact ?? [];
		const used = new Set(before.map((c) => c.method));
		const next_unused = ['email', 'twitter', 'nostr'].find((m) => !used.has(m));
		test.skip(!next_unused, 'fixture already has all three contact methods — auto-pick lands on duplicate, covered separately');

		const host = await openInfoPage(page);
		await host.getByRole('button', {name: /new contact/i}).click();
		const newRow = host.locator('orc-mint-subsection-info-form-contact').last();

		// `getAddedMethod()` seeds `init_method` to the first unused of
		// email/twitter/nostr; the contact child writes that into the
		// subgroup's `method` control inside `ngAfterViewInit`.
		const expectedLabel = ({email: 'Email', twitter: 'X', nostr: 'Nostr'} as Record<string, string>)[next_unused!];
		await expect(newRow.locator('mat-select-trigger')).toContainText(expectedLabel);

		const probeInfo = `e2e-probe@example.test`;
		await typeInto(newRow.locator('input[formControlName="info"]'), probeInfo);
		await expectSuccessAndSettle(page, 'mint_contact_add', () => newRow.locator('input[formControlName="info"]').press('Enter'));

		const afterContacts = mint.getInfo(config, {fresh: true}).contact ?? [];
		expect(afterContacts.some((c) => c.method === next_unused && c.info === probeInfo)).toBe(true);
		expect(afterContacts.length).toBe(before.length + 1);

		// Cleanup.
		await expectSuccessAndSettle(page, 'mint_contact_remove', () => newRow.locator('button[matSuffix]').click());
		const restored = mint.getInfo(config, {fresh: true}).contact ?? [];
		expect(restored.some((c) => c.method === next_unused && c.info === probeInfo)).toBe(false);
		expect(restored.length).toBe(before.length);
	});
});

test.describe('mint-subsection-info — bulk chip flows', {tag: '@mint'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/mint/info');
	});

	test('bulk save: dirtying two scalar fields and confirming via the chip fires one BulkMintUpdate that persists both', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		const original_description = info.description ?? '';
		const original_long = info.description_long ?? '';
		const probe_description = `${original_description}${original_description ? ' ' : ''}bulk-probe`;
		const probe_long = `${original_long}${original_long ? ' ' : ''}bulk-probe-long`;
		const host = await openInfoPage(page);

		await typeInto(fieldInput(host, 'orc-mint-subsection-info-form-description'), probe_description);
		await typeInto(fieldInput(host, 'orc-mint-subsection-info-form-description-long'), probe_long);
		// Click outside the focused input so the chip's "N updates" reading is final.
		await host.locator('mat-card-content').click({position: {x: 5, y: 5}});
		await expect(eventChip(page)).toContainText(/2 updates/);

		// Click the chip body to confirm — its `onClick` emits `save` while
		// `pending_event()` is true, which the nav surface forwards to
		// `EventService.confirmEvent(true)`.
		await confirmChip(page);

		const bulkResponse = await page.waitForResponse(matchGql('BulkMintUpdate'));
		expect(bulkResponse.ok()).toBe(true);
		await expect(eventToast(page).filter({hasText: 'Information updated'})).toBeVisible();

		const after = mint.getInfo(config, {fresh: true});
		expect(after.description).toBe(probe_description);
		expect(after.description_long).toBe(probe_long);

		// Cleanup: dirty both fields with the originals and chip-confirm a
		// second bulk save to revert symmetrically. This avoids racing two
		// per-field saves where the SUCCESS toast from the first lingers and
		// confuses the second's wait predicate.
		await typeInto(fieldInput(host, 'orc-mint-subsection-info-form-description'), original_description);
		await typeInto(fieldInput(host, 'orc-mint-subsection-info-form-description-long'), original_long);
		await host.locator('mat-card-content').click({position: {x: 5, y: 5}});
		await expect(eventChip(page)).toContainText(/2 updates/);
		await confirmChip(page);
		await page.waitForResponse(matchGql('BulkMintUpdate'));

		const restored = mint.getInfo(config, {fresh: true});
		expect(restored.description).toBe(original_description);
		expect(restored.description_long).toBe(original_long);
	});

	test('bulk cancel: dirtying fields then dismissing the chip reverts both inputs and fires no mutation', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		const original_description = info.description ?? '';
		const original_long = info.description_long ?? '';
		const host = await openInfoPage(page);

		// Track that no mutation request goes out during the cancel flow.
		let mutationCount = 0;
		const recordMutation = (req: Awaited<ReturnType<Page['waitForRequest']>>) => {
			const body = req.postData() ?? '';
			if (body.includes('mint_short_description_update') || body.includes('mint_long_description_update') || body.includes('BulkMintUpdate')) {
				mutationCount++;
			}
		};
		page.on('request', recordMutation);

		await typeInto(fieldInput(host, 'orc-mint-subsection-info-form-description'), `${original_description} probe`);
		await typeInto(fieldInput(host, 'orc-mint-subsection-info-form-description-long'), `${original_long} probe`);
		await host.locator('mat-card-content').click({position: {x: 5, y: 5}});
		await expect(eventChip(page)).toContainText(/2 updates/);

		// Cancel: click the chip's leading mat-icon-button (only visible during
		// PENDING-with-message). Emits `cancel` → `EventService.confirmEvent(false)`
		// → parent's `onUnconfirmedEvent` reverts every dirty control.
		await cancelChip(page);

		// Inputs reset; no hot-form-field highlight remains.
		await expect(fieldInput(host, 'orc-mint-subsection-info-form-description')).toHaveValue(original_description);
		await expect(fieldInput(host, 'orc-mint-subsection-info-form-description-long')).toHaveValue(original_long);
		await expect(host.locator('.orc-hot-form-field')).toHaveCount(0);

		// Give any straggling request 200ms to land before unsubscribing — the
		// cancel flow should not have triggered any.
		await page.waitForTimeout(200);
		page.off('request', recordMutation);
		expect(mutationCount).toBe(0);

		// Daemon truth unchanged.
		const after = mint.getInfo(config, {fresh: true});
		expect(after.description ?? '').toBe(original_description);
		expect(after.description_long ?? '').toBe(original_long);
	});
});

test.describe('mint-subsection-info — validation', {tag: '@mint'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/mint/info');
	});

	test('name longer than 200 chars surfaces a mat-error and blocks per-field save', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const original = mint.getInfo(config).name ?? '';
		const tooLong = 'x'.repeat(201);
		const host = await openInfoPage(page);

		const nameInput = fieldInput(host, 'orc-mint-subsection-info-form-name');
		await typeInto(nameInput, tooLong);
		// `mat-error` only renders once the control is touched. Blur forces it.
		await nameInput.blur();
		await expect(host.locator('orc-mint-subsection-info-form-name mat-error')).toBeVisible();

		// Per-field save short-circuits when invalid — no mutation should fire.
		let sawMutation = false;
		const onReq = (req: Awaited<ReturnType<Page['waitForRequest']>>) => {
			if ((req.postData() ?? '').includes('mint_name_update')) sawMutation = true;
		};
		page.on('request', onReq);
		await nameInput.press('Enter');
		await page.waitForTimeout(250);
		page.off('request', onReq);
		expect(sawMutation).toBe(false);

		// Daemon unchanged.
		expect(mint.getInfo(config, {fresh: true}).name).toBe(original);

		// Restore: type the original back and save.
		await typeInto(nameInput, original);
		await expectSuccessAndSettle(page, 'mint_name_update', () => nameInput.press('Enter'));
	});

	test('duplicate contact methods surface an error event and block save', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const before = mint.getInfo(config).contact ?? [];
		const existing = before[0];
		test.skip(!existing, 'fixture has no contacts — duplicate-method path needs at least one existing entry');

		const host = await openInfoPage(page);
		await host.getByRole('button', {name: /new contact/i}).click();
		const newRow = host.locator('orc-mint-subsection-info-form-contact').last();

		// Force the new row's method to match the existing one. Click the
		// `<mat-select>` host element — Material binds its open handler there,
		// not on the inner `.mat-mdc-select-trigger` div. The panel mounts as
		// a `.cdk-overlay-pane` appended directly to `<body>`, NOT inside the
		// `.cdk-overlay-container` (that's only used for global-positioning
		// overlays like dialogs).
		await newRow.locator('mat-select').click();
		const panel = page.locator('.mat-mdc-select-panel').last();
		await expect(panel).toBeVisible();
		const expectedLabel = ({email: 'Email', twitter: 'X', nostr: 'Nostr'} as Record<string, string>)[existing.method];
		await panel.getByRole('option', {name: expectedLabel, exact: true}).click();
		await typeInto(newRow.locator('input[formControlName="info"]'), 'duplicate-probe@example.test');

		// Save — `hasDuplicateContactMethods` registers an ERROR event whose
		// message renders in the toast surface, not the chip.
		await newRow.locator('input[formControlName="info"]').press('Enter');
		await expect(eventToast(page).filter({hasText: /Contact method already set/i})).toBeVisible();

		// Daemon unchanged.
		const after = mint.getInfo(config, {fresh: true}).contact ?? [];
		expect(after.length).toBe(before.length);

		// Cleanup: delete the row we added (it's still pristine on the server).
		await newRow.locator('button[matSuffix]').click();
		// No mutation fires — the row was never persisted, so the parent's
		// `onArrayControlRemove` splices locally without a mint_contact_remove.
		await expect(host.locator('orc-mint-subsection-info-form-contact')).toHaveCount(before.length);
	});

	test('empty URL row shows a required-field mat-error after blur and blocks per-field save', async ({page}) => {
		const host = await openInfoPage(page);
		await host.getByRole('button', {name: /new url/i}).click();
		const newRow = host.locator('orc-mint-subsection-info-form-url').last();
		const input = newRow.locator('input');

		// Touch + leave empty.
		await input.click();
		await input.blur();
		await expect(newRow.locator('mat-error')).toBeVisible();

		// Save no-ops on invalid.
		let sawMutation = false;
		const onReq = (req: Awaited<ReturnType<Page['waitForRequest']>>) => {
			if ((req.postData() ?? '').includes('mint_url_add')) sawMutation = true;
		};
		page.on('request', onReq);
		await input.press('Enter');
		await page.waitForTimeout(250);
		page.off('request', onReq);
		expect(sawMutation).toBe(false);

		// Cleanup: delete the row (pristine server-side).
		await newRow.locator('button[matSuffix]').click();
	});
});
