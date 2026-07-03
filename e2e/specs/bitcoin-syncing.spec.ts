/**
 * Feature spec: `orc-index-subsection-dashboard-bitcoin-enabled-syncing` —
 * the IBD progress card on the dashboard that renders in place of the
 * blockchain/mempool tile while bitcoind is syncing.
 *
 * Gating: the parent only mounts this child when
 *   `!blockchain_info.is_synced`
 *   = `initialblockdownload || headers !== blocks`
 *
 * Every shipped regtest stack boots fully synced, so each test reads
 * `getblockchaininfo` directly and skips when the chain is already synced.
 * On a stack that boots partially-synced (e.g. via `compose.mainchain.yml`
 * snapshots) the same assertions exercise the live render path.
 *
 * Covers the structure operators see during sync:
 *   - card renders with the "Syncing" title
 *   - ring percentage matches `verificationprogress * 100`
 *   - five info-table rows present with the right labels
 *   - target height matches `bitcoin-cli getblockchaininfo.headers`
 *   - block height matches `bitcoin-cli getblockcount`
 *
 * States the component supports but this spec does NOT cover:
 *   - flash animation on value change (timing-sensitive; not deterministic
 *     in CI)
 *   - degenerate `block: null` empty-cell render (mid-flight first-paint
 *     state, hard to reach without query-timing manipulation)
 */

import {test, expect, type Locator, type Page} from '@playwright/test';

import {getConfig} from '@e2e/helpers/config';
import {btc} from '@e2e/helpers/backend';

interface BlockchainInfo {
	initialblockdownload: boolean;
	headers: number;
	blocks: number;
	verificationprogress: number;
}

/** Mirror of the `BitcoinBlockchainInfo.is_synced` getter on the client. */
function isSynced(info: BlockchainInfo): boolean {
	return !info.initialblockdownload && info.headers === info.blocks;
}

async function openSyncingCard(page: Page): Promise<Locator> {
	const card = page.locator('orc-index-subsection-dashboard-bitcoin-enabled-syncing');
	await expect(card).toBeVisible();
	return card;
}

/** Strip everything except digits — the `bitcoinGeneralBlock` pipe inserts
 *  thin-space separators (`911 863`) which we normalize away for compare. */
function digitsFrom(text: string): number {
	return parseInt(text.replace(/\D/g, ''), 10);
}

test.describe('bitcoin-enabled-syncing card', {tag: '@canary'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/');
	});

	test('renders the syncing card with title while bitcoind is in IBD', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const info = btc.getBlockchainInfo(config) as unknown as BlockchainInfo;
		test.skip(isSynced(info), 'bitcoind already synced — syncing card not mounted');

		const card = await openSyncingCard(page);
		await expect(card.getByText('Syncing', {exact: true})).toBeVisible();
	});

	test('renders the progress ring with the percentage label', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const info = btc.getBlockchainInfo(config) as unknown as BlockchainInfo;
		test.skip(isSynced(info), 'bitcoind already synced — syncing card not mounted');

		const card = await openSyncingCard(page);
		await expect(card.locator('orc-progress-circle')).toBeVisible();
		// Centre label is rendered through the `percent: '1.0-2'` pipe.
		await expect(card.locator('orc-progress-circle')).toContainText(/\d+(\.\d+)?%/);
	});

	test('progress percentage matches `verificationprogress` from bitcoind', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const info = btc.getBlockchainInfo(config) as unknown as BlockchainInfo;
		test.skip(isSynced(info), 'bitcoind already synced — syncing card not mounted');

		const card = await openSyncingCard(page);
		const label = (await card.locator('orc-progress-circle').first().textContent())?.trim() ?? '';
		const displayed = parseFloat(label.replace('%', ''));
		const expected = info.verificationprogress * 100;
		// `verificationprogress` advances continuously; allow a small drift
		// between the RPC read and the UI snapshot.
		expect(Math.abs(displayed - expected)).toBeLessThan(1);
	});

	test('info table renders the five expected rows with labels', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const info = btc.getBlockchainInfo(config) as unknown as BlockchainInfo;
		test.skip(isSynced(info), 'bitcoind already synced — syncing card not mounted');

		const card = await openSyncingCard(page);
		for (const label of ['Date', 'Block height', 'Best block', 'Log2 work', 'Target height']) {
			await expect(card.getByText(label, {exact: true})).toBeVisible();
		}
	});

	test('target height row matches `headers` from bitcoind', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const info = btc.getBlockchainInfo(config) as unknown as BlockchainInfo;
		test.skip(isSynced(info), 'bitcoind already synced — syncing card not mounted');

		const card = await openSyncingCard(page);
		const row = card.getByText('Target height', {exact: true}).locator('..');
		const displayed = (await row.locator('td').nth(1).textContent())?.trim() ?? '';
		expect(digitsFrom(displayed)).toBe(info.headers);
	});

	test('block height row matches `bitcoin-cli getblockcount`', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const info = btc.getBlockchainInfo(config) as unknown as BlockchainInfo;
		test.skip(isSynced(info), 'bitcoind already synced — syncing card not mounted');

		const card = await openSyncingCard(page);
		const row = card.getByText('Block height', {exact: true}).locator('..');
		const displayed = (await row.locator('td').nth(1).textContent())?.trim() ?? '';
		// Fresh blocks may land between our RPC read and the UI snapshot;
		// allow a 1-block drift.
		const blockcount = btc.blockCount(config);
		expect(Math.abs(digitsFrom(displayed) - blockcount)).toBeLessThanOrEqual(1);
	});
});
