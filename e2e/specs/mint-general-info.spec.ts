/**
 * Feature spec: `orc-mint-general-info` — the "Info" card that surfaces
 * Cashu mint identity on the dashboard index page (Mint row). Same
 * component is reused on /mint, but only the dashboard tile projects the
 * "Open Mint" FAB into <ng-content>, so the navigation tests cover the
 * dashboard surface.
 *
 * Differential against the live mint daemon. Each test reads the mint's
 * own NUT-06 `/v1/info` via the `mint` helper (docker-execs into the
 * mint container) and asserts the rendered card matches that truth —
 * name, description, urls, icon. No per-config tables; if the fixture
 * changes, the spec follows.
 *
 * Per-fixture branching. Different e2e configs leave the mint daemon
 * advertising different combinations of `info.urls` and `info.icon_url`.
 * Tests that depend on a particular field skip cleanly when the daemon
 * doesn't publish it. The skip pivot is `mint.getInfo()` rather than the
 * rendered card on purpose: when the daemon hides a field (cdk-mintd
 * with RPC enabled drops `urls` from `/v1/info` even though `mintd.toml`
 * declares them), Orchard's resolver hands the parent the same empty
 * payload, so the card and the daemon agree and the chip-related tests
 * skip in lockstep.
 *
 * Covers states reachable from a healthy regtest fixture:
 *   - structure: title, status dot, projected FAB
 *   - mint identity: name (clickable → /mint section) and description,
 *     pulled differentially from `mint.getInfo(config)`
 *   - traffic light: `online` (error=false; the dashboard tile passes
 *     `mint_errors().length > 0`, which is empty on a healthy fixture)
 *   - URI chip: per-fixture branch — when the daemon advertises
 *     `info.urls`, one chip per entry renders with the parsed hostname
 *     as label; when empty, the italic *No connections* fallback fires
 *   - URI chip click → `NetworkConnectionComponent` dialog: opens, title
 *     reflects `data.section + data.type`, full URL appears in the
 *     .mega-string row, dialog dismisses on Close. Only runs when at
 *     least one chip rendered.
 *   - icon: per-fixture branch — placeholder `+` button when the daemon
 *     leaves `info.icon_url` unset; the `'icon'` branch is skipped here
 *     (no fixture seeds an icon URL today)
 *   - description: real text (not the italic "No description" fallback);
 *     skipped if a future fixture nulls it
 *   - interaction: projected "Open Mint" FAB opens the desktop menu and
 *     navigates to /mint via the Dashboard link
 *
 * States the component supports but this spec does NOT cover:
 *   - `offline` (requires `mint_errors` non-empty; would mean docker-
 *     pausing the mint container — disruptive to sibling specs)
 *   - URI dialog status variants other than `'inactive'` — the public
 *     mint hostnames the fixtures advertise don't resolve from the e2e
 *     network, so `'Publicly reachable'` / `'API offline'` /
 *     `'Unknown status'` aren't reproducible here
 *   - `mint-general-icon` `'icon'` branch (requires a resolvable icon URL)
 *   - `mint-general-icon` `'error'` branch (parent never binds [error]
 *     on the icon child — dead from this parent's perspective)
 *   - `mint-general-name` `'error'` branch (parent never binds [error]
 *     on the name child — same; dead from this parent)
 *   - QR style slider + image toggle inside the dialog (raster timing-
 *     sensitive — covered in `network-connection.component.spec.ts`)
 */

import {test, expect, type Locator, type Page} from '@playwright/test';

import {getConfig} from '@e2e/helpers/config';
import {mint} from '@e2e/helpers/backend';

async function openInfoCard(page: Page): Promise<Locator> {
	// Dashboard tile renders the card with the "Open Mint" FAB projected.
	// /mint also hosts an `orc-mint-general-info` (no FAB), so scoping by
	// page would also pick that one up; the dashboard tile is the first
	// occurrence on `/`, which is where every spec navigates in beforeEach.
	const card = page.locator('orc-mint-general-info').first();
	await expect(card).toBeVisible();
	return card;
}

/** Wait for the URL block to settle — either a chip or the italic
 *  *No connections* fallback must be visible before assertions read it. */
async function waitForUrlBlock(card: Locator): Promise<void> {
	await expect(card.locator('mat-chip, .orc-outline-variant-color').first()).toBeVisible();
}

/** Click the URL chip and wait for `NetworkConnectionComponent` to
 *  mount in the page-level CDK overlay. Caller's `test.skip` gates the
 *  chip's existence. */
async function openUriDialog(page: Page): Promise<Locator> {
	const card = await openInfoCard(page);
	await waitForUrlBlock(card);
	await card.locator('mat-chip').first().click();
	const dialog = page.locator('orc-network-connection');
	// Wait for the component's data-bound content, not just the wrapper —
	// Material mounts the wrapper before the inner template fills in, and
	// under worker contention assertions can hit that gap.
	await expect(dialog.locator('.mega-string')).toBeVisible();
	return dialog;
}

test.describe('mint-general-info card', {tag: '@mint'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/');
	});

	test('renders the info card with a title', async ({page}) => {
		const card = await openInfoCard(page);
		await expect(card.getByText('Info', {exact: true})).toBeVisible();
	});

	test('displays the mint name advertised by the daemon', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		test.skip(!info.name, 'daemon does not advertise a mint name — fallback "Untitled Mint" path not asserted here');
		const card = await openInfoCard(page);
		await expect(card.getByText(info.name!, {exact: true})).toBeVisible();
	});

	test('displays the mint description advertised by the daemon', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		test.skip(!info.description, 'daemon does not advertise a description — "No description" fallback path not asserted here');
		const card = await openInfoCard(page);
		const descriptionRow = card.getByText('Description', {exact: true}).locator('..');
		await expect(descriptionRow.locator('.font-size-l').first()).toHaveText(info.description!);
	});

	test('renders the "online" state dot and label when the mint is healthy', async ({page}) => {
		// Dashboard tile passes `error = mint_errors().length > 0`. On a
		// fresh regtest stack the mint daemon is reachable, so the parent's
		// `errors_mint` array is empty ⇒ `error=false` ⇒ state computed
		// short-circuits to `'online'`.
		const card = await openInfoCard(page);
		await expect(card.locator('orc-graphic-status')).toBeVisible();
		await expect(card.getByText('online', {exact: true})).toBeVisible();
	});

	test('renders one URI chip per info.urls entry advertised by the daemon', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		const urls = info.urls ?? [];
		test.skip(urls.length === 0, 'daemon advertises no info.urls — see "No connections" test instead');

		const card = await openInfoCard(page);
		await waitForUrlBlock(card);
		await expect(card.locator('mat-chip')).toHaveCount(urls.length);
	});

	test('shows the "No connections" fallback when the daemon leaves info.urls empty', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		const urls = info.urls ?? [];
		test.skip(urls.length > 0, 'daemon advertises info.urls — see chip-count test instead');

		const card = await openInfoCard(page);
		await waitForUrlBlock(card);
		await expect(card.getByText('No connections', {exact: true})).toBeVisible();
	});

	test('URI chip label is the parsed hostname of the daemon URL', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		const urls = info.urls ?? [];
		test.skip(urls.length === 0, 'daemon advertises no info.urls — no chip to inspect');

		const card = await openInfoCard(page);
		await waitForUrlBlock(card);
		// `transformUrl()` in the component sets `label` to `URL.hostname` for non-onion URLs.
		const expectedHostname = new URL(urls[0]).hostname;
		await expect(card.locator('mat-chip').first()).toContainText(expectedHostname);
	});

	test('renders the placeholder icon when the daemon leaves info.icon_url unset', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		test.skip(!!info.icon_url, 'daemon advertises icon_url — placeholder branch not exercised here');

		const card = await openInfoCard(page);
		await expect(card.locator('orc-mint-general-icon .mint-icon-placeholder')).toBeVisible();
	});

	test('clicking the mint name navigates into the /mint section', async ({page}, testInfo) => {
		// Route lands on /mint/info under normal conditions, but redirects to /mint/error
		// when the route resolver sees an error in `errors_mint` (e.g. the public-url probe
		// failed). Either landing satisfies the component contract.
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		test.skip(!info.name, 'daemon advertises no name — clickable text-button branch not present');
		const card = await openInfoCard(page);
		await card.getByText(info.name!, {exact: true}).click();
		await expect(page).toHaveURL(/\/mint\/(info|error)$/);
	});

	test('clicking the placeholder icon navigates into the /mint section', async ({page}, testInfo) => {
		// Skips when an icon resolves; the `'icon'` branch uses a different DOM node
		// (`<img>` vs the `+` placeholder div) and would need its own test.
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		test.skip(!!info.icon_url, 'daemon advertises icon_url — image-branch click target differs');

		const card = await openInfoCard(page);
		await card.locator('orc-mint-general-icon .mint-icon-placeholder').click();
		await expect(page).toHaveURL(/\/mint\/(info|error)$/);
	});

	test('projects the "Open Mint" FAB into the card footer', async ({page}) => {
		const card = await openInfoCard(page);
		await expect(card.getByRole('button', {name: /open mint/i})).toBeVisible();
	});

	test('Open Mint menu navigates to /mint', async ({page}) => {
		// FAB → desktop matMenu → Dashboard link. Mobile bottom-sheet path skipped
		// (Playwright's default desktop viewport never hits it).
		const card = await openInfoCard(page);
		await card.getByRole('button', {name: /open mint/i}).click();
		await page.getByRole('link', {name: 'Dashboard'}).click();
		await expect(page).toHaveURL(/\/mint$/);
	});

	/* *******************************************************
		Child component: NetworkConnectionComponent (URI dialog)

		Opened by `onUriClick()` when the user clicks a URI chip. These
		tests only run on fixtures whose daemon advertises at least one
		URL — the "No connections" branch above covers the empty case.

		Data contract the parent hands to the child (asserted per-field below):
		  - section: literal 'mint'         → title reads "Mint …"
		  - type:    'clearnet' (https://)  → title reads "… clearnet connection"
		  - uri:     full daemon URL        → shown untruncated in .mega-string
		  - status:  'inactive' (regtest)   → public-mint hostnames don't
		                                      resolve from the e2e network,
		                                      so the probe always fails ⇒
		                                      subtitle "Not reachable"
	******************************************************** */

	test('clicking the URI chip opens the NetworkConnection dialog', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		test.skip((info.urls ?? []).length === 0, 'daemon advertises no info.urls — no chip to click');

		const card = await openInfoCard(page);
		await waitForUrlBlock(card);
		await card.locator('mat-chip').first().click();
		await expect(page.locator('orc-network-connection')).toBeVisible();
	});

	test('dialog title reflects data.section + data.type ("Mint clearnet connection" for https URLs)', async ({page}, testInfo) => {
		// `transformUrl()` emits 'tor' for `.onion`, 'insecure' for `http://`, 'clearnet' otherwise.
		// Skip if the fixture flips off https so this stays accurate.
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		const urls = info.urls ?? [];
		test.skip(urls.length === 0, 'daemon advertises no info.urls — no chip to open');
		test.skip(new URL(urls[0]).protocol !== 'https:', `daemon url is not https (${urls[0]})`);

		const dialog = await openUriDialog(page);
		await expect(dialog.getByText('Mint clearnet connection', {exact: true})).toBeVisible();
	});

	test('dialog URI row shows the full untruncated daemon URL', async ({page}, testInfo) => {
		// Chip label is truncated to hostname; the dialog must show the full URL for copy.
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		const urls = info.urls ?? [];
		test.skip(urls.length === 0, 'daemon advertises no info.urls — no chip to open');

		const dialog = await openUriDialog(page);
		await expect(dialog.locator('.mega-string')).toHaveText(urls[0]);
	});

	test('dialog subtitle reflects the reachability probe ("Not reachable" on regtest)', async ({page}, testInfo) => {
		// Public-mint hostnames don't resolve from the e2e network; probe always reports
		// `inactive` ⇒ subtitle 'Not reachable'. A future resolvable URL would need branching.
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		test.skip((info.urls ?? []).length === 0, 'daemon advertises no info.urls — no chip to open');

		const dialog = await openUriDialog(page);
		await expect(dialog.getByText('Not reachable', {exact: true})).toBeVisible();
	});

	test('dialog closes when the Close button is clicked', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		test.skip((info.urls ?? []).length === 0, 'daemon advertises no info.urls — no dialog to close');

		const dialog = await openUriDialog(page);
		await dialog.getByRole('button', {name: 'Close', exact: true}).click();
		await expect(page.locator('orc-network-connection')).toHaveCount(0);
	});

	test('clicking the URI copy button writes the daemon URL to the clipboard', async ({page, context}, testInfo) => {
		// Grant clipboard permissions so the test can read what the copy button wrote.
		// Chromium honours this; other browsers may reject and the test skips.
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		const urls = info.urls ?? [];
		test.skip(urls.length === 0, 'daemon advertises no info.urls — no URL to copy');

		try {
			await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		} catch {
			test.skip(true, 'clipboard permissions unavailable in this browser');
		}

		const dialog = await openUriDialog(page);
		await dialog.locator('orc-button-copy').first().click();
		const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
		expect(clipboardText).toBe(urls[0]);
	});

	test('QR style slider re-rasters the QR when changed', async ({page}, testInfo) => {
		// Each `qr_options.style` value emits a different SVG `<path>` `d` attribute.
		// Diff before/after rather than matching specific path text.
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		test.skip((info.urls ?? []).length === 0, 'daemon advertises no info.urls — no QR to inspect');

		const dialog = await openUriDialog(page);
		const qrPath = dialog.locator('svg path').first();
		await expect(qrPath).toBeAttached();
		const before = await qrPath.getAttribute('d');

		// Drive the slider via its underlying `<input>` — Material's drag handle is awkward to grab,
		// the native input fires `input` cleanly.
		await dialog.locator('input[matSliderThumb]').evaluate((el: HTMLInputElement) => {
			const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
			setter?.call(el, '3');
			el.dispatchEvent(new Event('input', {bubbles: true}));
		});

		await expect.poll(async () => qrPath.getAttribute('d')).not.toBe(before);
	});

	test('image toggle off removes the centre image from the QR', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		test.skip((info.urls ?? []).length === 0, 'daemon advertises no info.urls — no QR to inspect');

		const dialog = await openUriDialog(page);
		const qrImage = dialog.locator('svg image');
		await expect(qrImage).toHaveCount(1);

		await dialog.locator('mat-slide-toggle button').click();
		await expect(qrImage).toHaveCount(0);

		await dialog.locator('mat-slide-toggle button').click();
		await expect(qrImage).toHaveCount(1);
	});

	test('Download button saves a PNG named after the mint and dismisses the dialog', async ({page}, testInfo) => {
		// Single click both fires `qr_code.download(...)` and dismisses via `mat-dialog-close`.
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		test.skip((info.urls ?? []).length === 0, 'daemon advertises no info.urls — no QR to download');

		const dialog = await openUriDialog(page);
		const downloadPromise = page.waitForEvent('download');
		await dialog.getByRole('button', {name: 'Download', exact: true}).click();
		const download = await downloadPromise;

		expect(download.suggestedFilename()).toBe(`${info.name ?? ''}_qr.png`);

		// Dialog dismisses on the same click via `mat-dialog-close`.
		await expect(page.locator('orc-network-connection')).toHaveCount(0);
	});
});
