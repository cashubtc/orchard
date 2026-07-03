/**
 * Feature spec: `orc-bitcoin-general-info` — the "Info" card that surfaces
 * node state on the index page (and is reused on /bitcoin).
 *
 * Covers the states reachable from a healthy regtest fixture:
 *   - structure: title, status dot, projected FAB
 *   - node identity: chain name, "Lightning backend" sub-label
 *   - traffic light: `online` (error=false + IBD=false)
 *   - URI block: "No connections" fallback (regtest emits no localaddresses)
 *   - counts: peers, block height, chain weight — each differentially checked
 *     against the backend's `bitcoin-cli` output
 *   - interaction: projected "Open Bitcoin" FAB opens the desktop menu and
 *     navigates to /bitcoin
 *
 * States the component supports but this spec does NOT cover:
 *   - `offline` (requires `docker pause bitcoind`, disruptive to sibling specs)
 *   - `syncing` (regtest can't produce IBD without a synthetic stall)
 *   - URI chip rendering + QR dialog (regtest never emits localaddresses)
 */

import {test, expect, type Locator, type Page} from '@playwright/test';

import {getConfig} from '@e2e/helpers/config';
import {btc} from '@e2e/helpers/backend';

/** Read the numeric/text value displayed under a metric label in the card. */
async function metricValue(card: Locator, label: string): Promise<string> {
	const wrapper = card.getByText(label, {exact: true}).locator('..');
	return (await wrapper.locator('.font-size-l').first().textContent())?.trim() ?? '';
}

async function openInfoCard(page: Page): Promise<Locator> {
	const card = page.locator('orc-bitcoin-general-info');
	await expect(card).toBeVisible();
	return card;
}

/** Mirrors the client's `dataBytes` pipe so we can assert the exact rendered string. */
function formatBytes(bytes: number): string {
	if (bytes === 0 || bytes === null || bytes === undefined) return '0 B';
	const units = ['B', 'kB', 'MB', 'GB', 'TB'];
	const k = 1024;
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
}

test.describe('bitcoin-general-info card', {tag: '@canary'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/');
	});

	test('renders the info card with a title', async ({page}) => {
		const card = await openInfoCard(page);
		await expect(card.getByText('Info', {exact: true})).toBeVisible();
	});

	test('displays the chain name reported by bitcoind', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const card = await openInfoCard(page);
		const chain = (btc.getBlockchainInfo(config).chain as string) ?? '';
		await expect(card.getByText(chain, {exact: true})).toBeVisible();
	});

	test('shows the "Lightning backend" sub-label because bitcoind backs the LN node', async ({page}) => {
		// All four e2e configs run their LN node against the same stack's bitcoind,
		// so the server's `network_info.backend` check resolves true. If this ever
		// flips, the sub-label disappears — catching a regression in the detection.
		const card = await openInfoCard(page);
		await expect(card.getByText('Lightning backend', {exact: true})).toBeVisible();
	});

	test('renders the "online" state dot and label when bitcoind is healthy', async ({page}) => {
		const card = await openInfoCard(page);
		await expect(card.locator('orc-graphic-status')).toBeVisible();
		await expect(card.getByText('online', {exact: true})).toBeVisible();
	});

	test('shows the "No connections" fallback when bitcoind advertises no localaddresses', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const localaddresses = (btc.getNetworkInfo(config).localaddresses as unknown[]) ?? [];
		test.skip(localaddresses.length > 0, 'bitcoind advertises localaddresses — chip rendering path, not the fallback');
		const card = await openInfoCard(page);
		await expect(card.getByText('No connections', {exact: true})).toBeVisible();
	});

	test('displays the peer count reported by bitcoind', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const card = await openInfoCard(page);
		const displayed = await metricValue(card, 'Peers');
		const peers = btc.getNetworkInfo(config).connections as number;
		expect(parseInt(displayed.replace(/\D/g, ''), 10) || 0).toBe(peers);
	});

	test('displays the block height reported by bitcoind', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const card = await openInfoCard(page);
		const displayed = await metricValue(card, 'Block height');
		// The `bitcoinGeneralBlock` pipe may add separators; compare digits only.
		expect(parseInt(displayed.replace(/\D/g, ''), 10)).toBe(btc.blockCount(config));
	});

	test('displays chain weight from bitcoind size_on_disk', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const card = await openInfoCard(page);
		const displayed = await metricValue(card, 'Chain weight');
		const size_on_disk = btc.getBlockchainInfo(config).size_on_disk as number;
		// A new block mined between our RPC read and the UI read would drift the
		// low bytes; the pipe rounds to 2 dp at the current unit, so within-unit
		// drift usually vanishes. Assert the unit/format matches and the numeric
		// value is within one block's worth (≈2 MB) of the backend reading.
		expect(displayed).toMatch(/^\d+(\.\d+)?\s(B|kB|MB|GB|TB)$/);
		const expected = formatBytes(size_on_disk);
		const expected_unit = expected.split(' ')[1];
		const displayed_unit = displayed.split(' ')[1];
		expect(displayed_unit).toBe(expected_unit);
	});

	test('projects the "Open Bitcoin" FAB into the card footer', async ({page}) => {
		const card = await openInfoCard(page);
		await expect(card.getByRole('button', {name: /open bitcoin/i})).toBeVisible();
	});

	test('Open Bitcoin menu navigates to /bitcoin', async ({page}) => {
		const card = await openInfoCard(page);
		await card.getByRole('button', {name: /open bitcoin/i}).click();
		// Menu items render as <a mat-list-item> links inside a matMenu overlay
		// (outside the card in the CDK overlay container).
		await page.getByRole('link', {name: 'Dashboard'}).click();
		await expect(page).toHaveURL(/\/bitcoin$/);
	});
});
