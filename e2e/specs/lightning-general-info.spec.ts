/**
 * Feature spec: `orc-lightning-general-info` — the "Info" card that surfaces
 * LN node state on the dashboard index page (Lightning row).
 *
 * Covers the states reachable from a healthy regtest fixture:
 *   - structure: title, status dot, projected FAB
 *   - node identity: alias, "Mint backend" sub-label
 *   - traffic light: `online` (error=false + synced_to_chain + synced_to_graph)
 *   - counts: peers + open channels — each differentially checked against the
 *     LN backend's own `getinfo` (via lncli / lightning-cli)
 *   - URI block: chip renders when the LN node advertises at least one URI;
 *     skipped when the node returns an empty uris[]
 *   - URI chip click → `NetworkConnectionComponent` dialog: opens, title +
 *     subtitle + full URI + Close-button dismissal are all asserted end-to-end
 *     (QR internals are left to the child's unit spec)
 *   - interaction: projected "Open Lightning" FAB navigates to /lightning
 *
 * States the component supports but this spec does NOT cover:
 *   - `offline` (requires `docker pause <ln-container>`, disruptive to siblings)
 *   - `syncing` (can't be synthesized on regtest without a synthetic stall)
 *   - QR style slider + image toggle inside the dialog (raster timing-sensitive —
 *     covered in `network-connection.component.spec.ts`)
 *   - `data.type === 'tor'` in the dialog (regtest never emits onion URIs)
 *   - `status === 'active'` / `'warning'` dialog subtitles (regtest probe always
 *     returns `'inactive'` for the private-range container IP)
 *   - empty-URIs branch (LND/CLN always emit at least one address on regtest)
 *   - `backend === false` (every e2e config feeds its mint off this LN node)
 */

import {test, expect, type Locator, type Page} from '@playwright/test';

import {getConfig} from '@e2e/helpers/config';
import {ln} from '@e2e/helpers/backend';

/** Raw getinfo shape — we only read fields that LND and CLN both emit under
 *  the same name. Both backends expose these exact keys on regtest. */
type LnGetInfo = {
	alias: string;
	num_peers: number;
	num_active_channels: number;
	num_inactive_channels: number;
	uris?: string[];
};

/** Read the numeric/text value displayed under a metric label in the card.
 *  Mirrors the helper in bitcoin-general-info.spec.ts — the label->value
 *  DOM pattern is shared between the two info cards. */
async function metricValue(card: Locator, label: string): Promise<string> {
	const wrapper = card.getByText(label, {exact: true}).locator('..');
	return (await wrapper.locator('.font-size-l').first().textContent())?.trim() ?? '';
}

async function openInfoCard(page: Page): Promise<Locator> {
	const card = page.locator('orc-lightning-general-info');
	await expect(card).toBeVisible();
	return card;
}

/** Clicks the first URI chip and waits for `NetworkConnectionComponent` to mount.
 *  The dialog renders in the CDK overlay container (page-scoped, not card-scoped). */
async function openUriDialog(page: Page): Promise<Locator> {
	const card = await openInfoCard(page);
	await card.locator('mat-chip').first().click();
	const dialog = page.locator('orc-network-connection');
	// Wait for the component's data-bound content, not just the wrapper —
	// Material mounts the wrapper before the inner template fills in, and
	// under worker contention assertions can hit that gap.
	await expect(dialog.locator('.mega-string')).toBeVisible();
	return dialog;
}

/** Strip everything except digits. Handles "2", "12 Peers", etc. */
function digitsFrom(text: string): number {
	return parseInt(text.replace(/\D/g, ''), 10);
}

test.describe('lightning-general-info card', {tag: '@lightning'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/');
	});

	test('renders the info card with a title', async ({page}) => {
		const card = await openInfoCard(page);
		await expect(card.getByText('Info', {exact: true})).toBeVisible();
	});

	test('displays the alias reported by the LN node', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const card = await openInfoCard(page);
		const alias = (ln.getInfo(config) as LnGetInfo).alias ?? '';
		await expect(card.getByText(alias, {exact: true})).toBeVisible();
	});

	test('shows the "Mint backend" sub-label because this LN node feeds the Cashu mint', async ({page}) => {
		// All four e2e configs wire their Cashu mint (nutshell or cdk) to this
		// same stack's LN node, so the server's `lightning_info.backend` check
		// resolves true. If this ever flips, the sub-label disappears — catching
		// a regression in the detection.
		const card = await openInfoCard(page);
		await expect(card.getByText('Mint backend', {exact: true})).toBeVisible();
	});

	test('renders a state dot + state label that matches the LN node sync flags', async ({page}, testInfo) => {
		// The component's `state` computed returns `'syncing'` when either
		// `synced_to_chain` or `synced_to_graph` is false, else `'online'`.
		// On regtest, idle LND legitimately reports `synced_to_chain=false`
		// (no continuous block flow), so we differential against the LN node's
		// own sync state rather than asserting a fixed `'online'`.
		const config = getConfig(testInfo.project.name);
		const card = await openInfoCard(page);
		await expect(card.locator('orc-graphic-status')).toBeVisible();
		const expected = ln.synced(config) ? 'online' : 'syncing';
		await expect(card.getByText(expected, {exact: true})).toBeVisible();
	});

	test('displays the peer count reported by the LN node', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const card = await openInfoCard(page);
		const displayed = await metricValue(card, 'Peers');
		const info = ln.getInfo(config) as LnGetInfo;
		expect(digitsFrom(displayed) || 0).toBe(info.num_peers);
	});

	test('displays the open channel count from num_active + num_inactive', async ({page}, testInfo) => {
		// `open_channels` on the component is `num_active + num_inactive` — it
		// deliberately excludes `num_pending_channels`. Regtest opens only
		// confirmed channels via fund-lnd.sh, so pending is 0 and the simple
		// sum matches the UI.
		const config = getConfig(testInfo.project.name);
		const card = await openInfoCard(page);
		const displayed = await metricValue(card, 'Channels');
		const info = ln.getInfo(config) as LnGetInfo;
		const expected = (info.num_active_channels ?? 0) + (info.num_inactive_channels ?? 0);
		expect(digitsFrom(displayed) || 0).toBe(expected);
	});

	test('renders a URI chip when the LN node advertises at least one URI', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const info = ln.getInfo(config) as LnGetInfo;
		// LND's `getinfo` exposes uris[] directly. CLN returns `address[]`
		// separately and Orchard's server builds uris from id@address:port —
		// `getinfo` alone won't tell us that story, so on CLN stacks we skip
		// rather than false-fail.
		test.skip(config.ln === 'cln', 'CLN getinfo does not expose a pre-formatted uris[] — server-built, not differentially assertable from cli alone');
		test.skip(!info.uris || info.uris.length === 0, 'LN node advertises no URIs — chip rendering path, nothing to assert');

		const card = await openInfoCard(page);
		// One chip per URI. Prefix of the displayed label is the first 11 chars
		// of the pubkey (from `transformUri()` in the component). The live URI
		// on regtest is `{orchard_pubkey}@172.26.0.4:9735` — private IP, so the
		// status icon is inactive (red), but the chip itself always renders.
		await expect(card.locator('mat-chip')).toHaveCount(info.uris!.length);
	});

	test('projects the "Open Lightning" FAB into the card footer', async ({page}) => {
		const card = await openInfoCard(page);
		await expect(card.getByRole('button', {name: /open lightning/i})).toBeVisible();
	});

	test('Open Lightning FAB navigates to /lightning', async ({page}) => {
		// Unlike the Bitcoin card (which opens a mat-menu of sub-routes), this
		// FAB carries `[routerLink]="['/lightning']"` directly — a single click
		// is sufficient to land on the lightning section.
		const card = await openInfoCard(page);
		await card.getByRole('button', {name: /open lightning/i}).click();
		await expect(page).toHaveURL(/\/lightning$/);
	});

	/* *******************************************************
		Child component: NetworkConnectionComponent (URI dialog)

		Opened by `onUriClick()` when the user clicks a URI chip. The chip
		renders on any regtest backend that emits at least one URI (LND and
		CLN both do — LND via `getinfo.uris[]`, CLN via server-built
		`id@address:port`), so these tests run on every config.

		Data contract the parent hands to the child (asserted per-field below):
		  - section: literal 'lightning'     → title reads "Lightning …"
		  - type:    'clearnet' (regtest)    → title reads "… clearnet connection"
		  - uri:     full pubkey@address     → shown untruncated in .mega-string
		  - status:  'inactive' (regtest)    → subtitle reads "Not reachable"
	******************************************************** */

	test('clicking a URI chip opens the NetworkConnection dialog', async ({page}) => {
		// The chip exists on any backend that rendered at least one URI. The
		// openInfoCard + chip visibility both run auto-waiting, so a missing
		// chip would fail here rather than at `click()`.
		const card = await openInfoCard(page);
		await expect(card.locator('mat-chip').first()).toBeVisible();
		await card.locator('mat-chip').first().click();
		await expect(page.locator('orc-network-connection')).toBeVisible();
	});

	test('dialog title reflects data.section + data.type ("Lightning clearnet connection" on regtest)', async ({page}) => {
		// `section` is the literal string 'lightning' (passed by the parent);
		// `type` is derived by `transformUri()` — `.onion` ⇒ 'tor', else
		// 'clearnet'. Regtest URIs are all private-range IPv4, never .onion,
		// so the type is deterministically 'clearnet' on every e2e config.
		const dialog = await openUriDialog(page);
		await expect(dialog.getByText('Lightning clearnet connection', {exact: true})).toBeVisible();
	});

	test('dialog URI row shows the full untruncated pubkey@address', async ({page}, testInfo) => {
		// The chip label truncates pubkey to 11 chars (see component.ts:71),
		// but the dialog's .mega-string must show the full URI so the user
		// can scan/copy the whole thing. LND-only: on CLN the server builds
		// the URI from pieces, and `ln.getInfo` doesn't return a pre-formatted
		// uris[] to diff against.
		const config = getConfig(testInfo.project.name);
		test.skip(config.ln === 'cln', 'CLN getinfo does not expose a pre-formatted uris[] — server-built, not differentially assertable');
		const info = ln.getInfo(config) as LnGetInfo;
		test.skip(!info.uris || info.uris.length === 0, 'LN node advertises no URIs — nothing to open');

		const dialog = await openUriDialog(page);
		await expect(dialog.locator('.mega-string')).toHaveText(info.uris![0]);
	});

	test('dialog subtitle reflects the reachability probe ("Not reachable" on regtest private IPs)', async ({page}) => {
		// `status_message` is a computed on `data.status`. The parent looks up
		// `connections_status_map.get(address)` where `address = uri.split('@')[1]`.
		// On regtest the LN container's host is a private-range 172.26.0.x IP;
		// the server's port-reachability probe rejects private ranges with
		// `reachable: false` ⇒ status `'inactive'` ⇒ subtitle `'Not reachable'`.
		// This is the default live state on every e2e stack.
		const dialog = await openUriDialog(page);
		await expect(dialog.getByText('Not reachable', {exact: true})).toBeVisible();
	});

	test('dialog closes when the Close button is clicked', async ({page}) => {
		// `Close` is `<button mat-button mat-dialog-close>Close</button>` — the
		// `mat-dialog-close` directive dismisses via MatDialogRef, which
		// detaches the component so `orc-network-connection` unmounts.
		const dialog = await openUriDialog(page);
		await dialog.getByRole('button', {name: 'Close', exact: true}).click();
		await expect(page.locator('orc-network-connection')).toHaveCount(0);
	});
});
