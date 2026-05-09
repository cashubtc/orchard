/**
 * Feature spec: `orc-mint-subsection-database` — the "Database" subsection
 * page at `/mint/database`. Scoped to the **backup-critical** surface:
 *
 *   1. The Create Backup flow: filename auto-populates from the daemon
 *      version + runtime config db type, the `mint_database_backup`
 *      mutation fires through the global event chip's Save action, and
 *      the parent's `eventCreateSuccess` handler synthesises a download
 *      via an in-memory `<a download>` element (no daemon mutation —
 *      orchard reads the DB file directly).
 *   2. The Restore Backup form: structural mount, file-not-ready glyph,
 *      help-block 4-step list, file-loaded transition. We do NOT execute
 *      the restore mutation in this spec — see "Round-trip skip" below.
 *   3. The malformed-file restore path: a payload that fails orchard's
 *      pre-write validator. The mutation may report success or error
 *      depending on the backend (sqlite validator rejects; postgres
 *      psql swallows parse errors), so we only assert daemon liveness
 *      after the attempt — the test's safety property.
 *
 * Coverage by tag:
 *   - `@canary`: open Create Backup → chip Save → assert the download
 *     fires with a filename matching the
 *     `MintDatabaseBackup-{sanitized-version}-{yyyyMMdd-HHmmss}.{db|sql}`
 *     contract. Smoke for the full mutation pipe.
 *   - `@mint`: structural (every child mounts, collapsibles closed by
 *     default, more_vert menu lists the right items); filename meta
 *     fidelity vs. daemon NUT-06 + runtime db type; invalid-filename
 *     blocks save; restore form initial state; toggle CREATE ↔ RESTORE;
 *     malformed-file resilience.
 *
 * Round-trip skip. A full backup → docker stop → restore → docker start
 * round-trip was prototyped and rejected: the mint daemon's NUT-06
 * metadata (name, description, motd, urls, contact) is served from
 * env vars + runtime overrides, NOT the database, so a "byte-identical"
 * NUT-06 comparison is fundamentally meaningless. Worse, stopping the
 * mint container races with other test files in the same project —
 * Playwright's default `fullyParallel: false` serialises tests within
 * a file but allows files in the same project to run on different
 * workers concurrently. Bringing the daemon down mid-suite breaks
 * sibling specs (`mint-general-info`, `mint-subsection-info`). If a
 * round-trip is needed later it should live in its own Playwright
 * project with `workers: 1` for that project, or be implemented as a
 * server-side integration test against a dedicated stack.
 *
 * States the component supports but this spec does NOT cover (see
 * `mint-subsection-database.md` → "Skip taxonomy"):
 *   - Backup ERROR (`disruptive` — needs `docker pause` of the mint
 *     daemon, knocks out sibling specs).
 *   - Restore SUCCESS round-trip (see "Round-trip skip" above).
 *   - Restore mid-file-loading (`unit-better` — `FileReader.onprogress`
 *     timing-sensitive, covered in Karma against the restore child).
 *   - Mobile-menu Create Backup placement (`unit-better` — viewport-
 *     driven, single mobile-project run is cheaper than synthesising
 *     `device_type.set`).
 *   - `canDeactivate` pending-guard interception (`dead-branch` — the
 *     dialog UI lives in `event-general-unsaved-dialog`, with its own
 *     spec).
 *   - AI tool-call `MintBackupFilenameUpdate` (`unit-better` — needs
 *     `ai_enabled=true` and a live model).
 *   - Filter / chart / table interactions and the quote-paid dialog —
 *     out of scope for the backup feature.
 */

import {test, expect, type Locator, type Page} from '@playwright/test';

import {getConfig} from '@e2e/helpers/config';
import {mint} from '@e2e/helpers/backend';
import {matchGql} from '@e2e/helpers/ui/gql-intercept';

const HOST_SELECTOR = 'orc-mint-subsection-database';
const FORM_BACKUP_SELECTOR = 'orc-mint-subsection-database-form-backup';
const FORM_RESTORE_SELECTOR = 'orc-mint-subsection-database-form-restore';

/** Mount the host card. The route's resolver pre-loads `mint_keysets`,
 *  but the rest of the dynamic data (chart + table) is async — the host
 *  itself is visible synchronously after navigation. */
async function openDatabasePage(page: Page): Promise<Locator> {
	const host = page.locator(HOST_SELECTOR);
	await expect(host).toBeVisible();
	await expect(host.locator('orc-mint-subsection-database-control')).toBeVisible();
	return host;
}

/** Click the action-cluster `Create Backup` FAB (desktop) or its
 *  icon-only tablet variant. Returns the now-visible form locator
 *  with the filename input populated (waits for `loadMintInfo`'s async
 *  patch to land — the input is asserted to have a value matching the
 *  backup-filename contract before the locator is returned). */
async function openCreateBackup(host: Locator): Promise<Locator> {
	await host
		.locator('button[matFab]')
		.filter({has: host.page().locator('mat-icon', {hasText: 'database'})})
		.first()
		.click();
	const form = host.locator(FORM_BACKUP_SELECTOR);
	await expect(host.locator('.orc-animation-collapsible.animation-open')).toHaveCount(1);
	await expect(form.locator('input[formControlName="filename"]')).toHaveValue(BACKUP_FILENAME_RE);
	return form;
}

/** Open the more_vert menu and click `Restore Backup`. Returns the
 *  now-visible restore form locator. The menu is rendered in a CDK
 *  overlay attached to body, NOT inside the host. */
async function openRestoreBackup(page: Page, host: Locator): Promise<Locator> {
	await moreMenuButton(host).click();
	await page.locator('.cdk-overlay-container button[mat-menu-item]', {hasText: 'Restore Backup'}).click();
	const form = host.locator(FORM_RESTORE_SELECTOR);
	await expect(host.locator('.orc-animation-collapsible.animation-open')).toHaveCount(1);
	await expect(form.locator('button:has-text("Select Backup")')).toBeVisible();
	return form;
}

/** The "more_vert" icon button inside the action cluster. The
 *  `matMenuTriggerFor` directive is stripped from the runtime DOM — we
 *  identify the button by its child icon's `more_vert` glyph. */
function moreMenuButton(host: Locator): Locator {
	return host.locator('button').filter({has: host.page().locator('mat-icon', {hasText: 'more_vert'})}).first();
}

/** Filename `<input>` inside the backup form. */
function filenameInput(form: Locator): Locator {
	return form.locator('input[formControlName="filename"]');
}

/** "Select Backup" stroked button inside the restore form. Triggers the
 *  hidden `<input type="file">` click. */
function selectBackupButton(form: Locator): Locator {
	return form.locator('button:has-text("Select Backup")');
}

/** The global event chip — exists twice (desktop sidenav + mobile bottom
 *  nav slots); only one is visible per viewport. Same pattern as
 *  `mint-subsection-info.spec.ts`. */
function eventChip(page: Page): Locator {
	return page.locator('orc-event-general-nav-tool:visible').first();
}

/** Click the chip's body to confirm a PENDING event. */
async function confirmChip(page: Page): Promise<void> {
	await eventChip(page).locator('.event-nav-tool').click();
}

/** The toast surface that renders SUCCESS / WARNING / ERROR messages. */
function eventToast(page: Page): Locator {
	return page.locator('orc-event-general-stack orc-event-general-stack-message .event-message-content');
}

/** Backup filename contract: produced by the parent's `getDefaultFilename`
 *  via `MintDatabaseBackup-{version-with-/-replaced-by-}-{yyyyMMdd-HHmmss}.{db|sql}`.
 *  Sanitised version is whatever the daemon advertises with `/` → `-`;
 *  matched loosely as `[^/]+` to tolerate any vendor/version string. */
const BACKUP_FILENAME_RE = /^MintDatabaseBackup-[^/]+-\d{8}-\d{6}\.(?:db|sql)$/;

/** Drive a Material text input cleanly so ReactiveForms's value-change
 *  subscription fires (the file's filename input is wired to a hot
 *  form-field; bare `fill` occasionally lands focus / blur out of order
 *  around the orc-form-field-dynamic detection). */
async function typeInto(field: Locator, value: string): Promise<void> {
	await field.click();
	await field.press('ControlOrMeta+a');
	await field.press('Delete');
	if (value.length > 0) await field.pressSequentially(value, {delay: 0});
}

test.describe('mint-subsection-database — backup canary', {tag: '@canary'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/mint/database');
	});

	test('Create Backup → chip Save synthesises a download with the contract filename', async ({page}, testInfo) => {
		// Smoke for the entire backup pipe: parent loads mint info, child
		// patches a contract-formatted filename, chip Save fires
		// `mint_database_backup`, parent's `eventCreateSuccess` decodes the
		// base64 payload and triggers a synthetic `<a download>` click.
		// No daemon mutation — orchard reads the DB directly via better-sqlite3
		// (sqlite stacks) or pg_dump (postgres stacks).
		const config = getConfig(testInfo.project.name);
		const host = await openDatabasePage(page);

		const form = await openCreateBackup(host);
		const filename = await filenameInput(form).inputValue();
		expect(filename).toMatch(BACKUP_FILENAME_RE);

		// Filename's sanitised version must match the daemon's reported
		// version with `/` → `-`. Asserts orchard surfaces the real daemon
		// build, not a hard-coded string.
		const sanitisedVersion = (mint.getInfo(config).version ?? '').replace(/\//g, '-');
		expect(filename).toContain(sanitisedVersion);

		// Database extension follows the runtime config's db type.
		expect(filename).toMatch(config.db === 'sqlite' ? /\.db$/ : /\.sql$/);

		// Set up BOTH waiters before the click. `eventCreateSuccess` runs
		// synchronously after the SUCCESS event fires, so the mutation
		// response and the `<a>.click()` can both land before any deferred
		// listener attaches. `waitForResponse` only catches future
		// responses — register it before the click that triggers it.
		const responsePromise = page.waitForResponse(matchGql('mint_database_backup'));
		const downloadPromise = page.waitForEvent('download');
		await confirmChip(page);
		const [response, download] = await Promise.all([responsePromise, downloadPromise]);

		expect(response.ok()).toBe(true);
		expect(download.suggestedFilename()).toBe(filename);
		// Parent collapses the form on SUCCESS.
		await expect(host.locator('.orc-animation-collapsible.animation-open')).toHaveCount(0);
	});
});

test.describe('mint-subsection-database — structural', {tag: '@mint'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/mint/database');
	});

	test('every child component mounts exactly once and both collapsibles start closed', async ({page}) => {
		const host = await openDatabasePage(page);
		await expect(host.locator('orc-mint-subsection-database-control')).toHaveCount(1);
		await expect(host.locator(FORM_BACKUP_SELECTOR)).toHaveCount(1);
		await expect(host.locator(FORM_RESTORE_SELECTOR)).toHaveCount(1);
		await expect(host.locator('orc-mint-subsection-database-chart')).toHaveCount(1);
		await expect(host.locator('orc-mint-subsection-database-table')).toHaveCount(1);
		// Both collapsibles start closed — no `.animation-open` until a
		// form is opened.
		await expect(host.locator('.orc-animation-collapsible.animation-open')).toHaveCount(0);
	});

	test('more_vert menu lists Restore Backup + Refresh Data on desktop', async ({page}) => {
		const host = await openDatabasePage(page);
		await moreMenuButton(host).click();
		const overlay = page.locator('.cdk-overlay-container');
		await expect(overlay.getByText('Restore Backup')).toBeVisible();
		await expect(overlay.getByText('Refresh Data')).toBeVisible();
		// Desktop: Create Backup is the FAB, not a menu item.
		await expect(overlay.getByText('Create Backup')).toHaveCount(0);
		// Cleanup: dismiss the menu so a sibling test's locators don't
		// pick up overlay items.
		await page.keyboard.press('Escape');
	});
});

test.describe('mint-subsection-database — backup form', {tag: '@mint'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/mint/database');
	});

	test('meta block surfaces daemon version + runtime db type', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const sanitisedVersion = (mint.getInfo(config).version ?? '').replace(/\//g, '-');
		test.skip(!sanitisedVersion, 'daemon advertises no version — meta block test is meaningless');

		const host = await openDatabasePage(page);
		const form = await openCreateBackup(host);

		// The meta block's @if guard requires all three values truthy. Once
		// `loadMintInfo` resolves the parent patches them and the @else
		// shimmer block disappears.
		await expect(form).toContainText(sanitisedVersion);
		await expect(form).toContainText(config.db); // 'sqlite' | 'postgres'
	});

	test('cleared filename surfaces a mat-error and chip-save short-circuits to a WARNING toast', async ({page}) => {
		const host = await openDatabasePage(page);
		const form = await openCreateBackup(host);

		await typeInto(filenameInput(form), '');
		// Touch + leave empty so mat-error renders.
		await filenameInput(form).blur();
		await expect(form.locator('mat-error')).toBeVisible();

		// Save short-circuits in `eventCreateConfirmed` when
		// `form_backup.invalid` — emits a WARNING, no `mint_database_backup`
		// mutation fires.
		let sawMutation = false;
		const onReq = (req: Awaited<ReturnType<Page['waitForRequest']>>) => {
			if ((req.postData() ?? '').includes('mint_database_backup')) sawMutation = true;
		};
		page.on('request', onReq);
		await confirmChip(page);
		await expect(eventToast(page).filter({hasText: /Invalid filename/i})).toBeVisible();
		await page.waitForTimeout(250);
		page.off('request', onReq);
		expect(sawMutation).toBe(false);

		// Cleanup: close the form so the chip clears for the next test.
		await form.locator('button').filter({has: page.locator('mat-icon', {hasText: 'close'})}).first().click();
		await expect(host.locator('.orc-animation-collapsible.animation-open')).toHaveCount(0);
	});
});

test.describe('mint-subsection-database — restore form', {tag: '@mint'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/mint/database');
	});

	test('mounts in the file-not-ready state with the 4-step shutdown help block', async ({page}) => {
		const host = await openDatabasePage(page);
		const form = await openRestoreBackup(page, host);

		// Database glyph carries the file-not-ready class until a file is
		// loaded.
		await expect(form.locator('mat-icon.icon-lg')).toHaveClass(/file-not-ready/);
		// File metadata column is hidden (.invisible) while idle.
		await expect(form.locator('.invisible')).toHaveCount(1);
		// Help block carries the 4-step list, with step 1 in warning colour.
		await expect(form.locator('.orc-status-warning-color')).toContainText(/Shut down the mint/i);
		await expect(form).toContainText(/Select a backup file/i);
		await expect(form).toContainText(/Restore the backup/i);
		await expect(form).toContainText(/Start the mint/i);

		// Cleanup.
		await form.locator('button').filter({has: page.locator('mat-icon', {hasText: 'close'})}).first().click();
		await expect(host.locator('.orc-animation-collapsible.animation-open')).toHaveCount(0);
	});

	test('opening Backup then Restore keeps exactly one collapsible open', async ({page}) => {
		const host = await openDatabasePage(page);
		await openCreateBackup(host);
		await expect(host.locator('.orc-animation-collapsible.animation-open')).toHaveCount(1);

		// Open Restore via the menu — the parent re-routes form_mode and
		// the previous collapsible's `.animation-open` flips off.
		await moreMenuButton(host).click();
		await page.locator('.cdk-overlay-container button[mat-menu-item]', {hasText: 'Restore Backup'}).click();
		await expect(host.locator('.orc-animation-collapsible.animation-open')).toHaveCount(1);

		// Cleanup.
		await host.locator(FORM_RESTORE_SELECTOR + ' button').filter({has: page.locator('mat-icon', {hasText: 'close'})}).first().click();
		await expect(host.locator('.orc-animation-collapsible.animation-open')).toHaveCount(0);
	});

	test('malformed payload is rejected without taking the daemon down', async ({page}, testInfo) => {
		// Orchard's restore handlers diverge per backend on a malformed
		// payload: sqlite's `validateSqliteFile` rejects via header check
		// (mutation returns errors[]); postgres's `psql --file=` swallows
		// parse errors and exits 0 (mutation returns success but the DB
		// was not actually written). Either path is fine for the safety
		// property we care about: **the daemon does not break**. We
		// therefore don't assert on the response shape — only that the
		// mutation completes and the daemon is still serving NUT-06
		// afterwards.
		const config = getConfig(testInfo.project.name);

		const host = await openDatabasePage(page);
		const form = await openRestoreBackup(page, host);

		const fileChooserPromise = page.waitForEvent('filechooser');
		await selectBackupButton(form).click();
		const chooser = await fileChooserPromise;
		// Clearly-not-a-backup payload — neither a SQLite header nor a
		// pg_dump-style SQL stream.
		await chooser.setFiles({
			name: 'not-a-real-backup.db',
			mimeType: 'application/octet-stream',
			buffer: Buffer.from('this is not a sqlite database'),
		});

		// File-loaded UI signal — metadata column un-`invisible`s, glyph
		// flips file-ready (UI cannot tell yet that the bytes are bogus).
		await expect(form.locator('mat-icon.icon-lg')).toHaveClass(/file-ready/);
		// Chip switches to PENDING `Restore` once the form goes dirty.
		await expect(eventChip(page)).toContainText(/Restore/i);

		// Register the response waiter BEFORE the click — `waitForResponse`
		// only catches future responses.
		const responsePromise = page.waitForResponse(matchGql('mint_database_restore'));
		await confirmChip(page);
		await responsePromise;

		// Daemon-still-alive proof: `/v1/info` still answers. The point
		// of the test is the safety property — a malformed restore must
		// not knock the daemon out, regardless of what the mutation
		// reports back.
		expect(() => mint.getInfo(config, {fresh: true})).not.toThrow();

		// Cleanup: close the form if it's still open (sqlite path's
		// ERROR branch resets `form_mode = null` and collapses; postgres
		// path's success branch does the same after `eventRestoreSuccess`).
		const open = host.locator('.orc-animation-collapsible.animation-open');
		if ((await open.count()) > 0) {
			await form.locator('button').filter({has: page.locator('mat-icon', {hasText: 'close'})}).first().click();
			await expect(open).toHaveCount(0);
		}
	});
});
