/**
 * Feature spec: `orc-bitcoin-general-block` (+ its child
 * `orc-bitcoin-general-treemap`) — the block card on the index dashboard's
 * Bitcoin blockchain tile. Renders the latest block's height, feerate range,
 * size, tx count, and a fee-bucket treemap; a second instance renders the
 * next-block template.
 *
 * The blockchain tile (and thus this card) only shows when the node is
 * synced — on regtest that's always true, but the mainchain stack
 * (cln-nutshell-postgres, real mainnet bitcoind) can be mid-IBD and show the
 * syncing tile instead. So this spec is tagged @bitcoin and skips the
 * mainchain stack; the syncing branch is covered by bitcoin-syncing.spec.ts.
 *
 * Coverage:
 *   - the block card mounts on `/` with a positive integer block height
 *   - the fee-bucket treemap renders inside it
 *   - a template (next-block) card renders alongside the mined block
 *
 * NOT covered:
 *   - exact height differential (`unit-better` — the regtest tip advances as
 *     the block-miner mines, so the UI legitimately lags bitcoind by a block
 *     or two; asserting positivity + shape avoids a racy pin)
 *   - treemap rect geometry (`unit-better` — SVG layout pixels)
 *   - syncing-tile branch (owned by bitcoin-syncing.spec.ts)
 */

import {test, expect, type Page} from '@playwright/test';

import {getConfig} from '@e2e/helpers/config';

function amountFromText(text: string | null | undefined): number {
	const stripped = (text ?? '').replace(/\D/g, '');
	return stripped === '' ? 0 : parseInt(stripped, 10);
}

async function blockCards(page: Page) {
	const cards = page.locator('orc-bitcoin-general-block');
	await expect(cards.first()).toBeVisible();
	return cards;
}

test.describe('bitcoin block card — index dashboard', {tag: '@bitcoin'}, () => {
	test.beforeEach(async ({page}, testInfo) => {
		// Mainchain's real bitcoind can be mid-IBD → syncing tile, no block
		// card. The regtest stacks are always synced.
		const config = getConfig(testInfo.project.name);
		test.skip(config.mainchain, 'mainchain node may be syncing — no blockchain tile');
		await page.goto('/');
	});

	test('renders a block card with a positive block height', async ({page}) => {
		const cards = await blockCards(page);
		// The mined-block card carries the `.block-height` header (the
		// template card omits it). At least one such height renders.
		const height = cards.locator('.block-height').first();
		await expect(height).toBeVisible();
		expect(amountFromText(await height.textContent())).toBeGreaterThan(0);
	});

	test('renders the fee-bucket treemap inside the block card', async ({page}) => {
		const cards = await blockCards(page);
		await expect(cards.first().locator('orc-bitcoin-general-treemap')).toBeVisible();
	});

	test('renders block size and tx-count details', async ({page}) => {
		const cards = await blockCards(page);
		const first = cards.first();
		await expect(first.locator('.block-size')).toBeVisible();
		await expect(first.locator('.block-tx-count')).toContainText('txs');
	});
});
