/**
 * Feature spec: `orc-index-subsection-dashboard-bitcoin-enabled-blockchain` —
 * the "mempool-style" block visualization on the dashboard (template block,
 * divider, confirmed tip).
 *
 * Covers the states reachable from a healthy regtest fixture:
 *   - structure: template column, divider, confirmed column, chained half
 *   - arrow indicator class matches the `getTargetBlock()` decision computed
 *     from the same GraphQL payloads the component consumes (differential
 *     against `bitcoin_block_template` + `bitcoin_transaction_fee_estimates`)
 *   - confirmed block shows height, byte size, and tx count that match
 *     `bitcoin-cli getblockcount` / `getblock <hash> 2`
 *   - template block renders with the "~10 min" next-block label
 *   - mempool half-block presence matches the `mempool_depth` snapshot
 *     (empty mempool → no `.block-half.block-template` gradient)
 *
 * States the component supports but this spec does NOT cover:
 *   - tip-change flash animation (hard to observe deterministically)
 *   - target-change emission (the `<mat-select>` that would emit it is
 *     commented out in the template)
 */

import {test, expect, type Locator, type Page, type Response} from '@playwright/test';

import {getConfig} from '@e2e/helpers/config';
import {btc} from '@e2e/helpers/backend';
import {matchGql} from '@e2e/helpers/ui/gql-intercept';

/** Mirrors the client's `dataBytes` pipe — used to assert size rendering
 *  against `bitcoin-cli` output in the same unit the UI picks. */
function formatBytes(bytes: number): string {
	if (bytes === 0 || bytes === null || bytes === undefined) return '0 B';
	const units = ['B', 'kB', 'MB', 'GB', 'TB'];
	const k = 1024;
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${units[i]}`;
}

async function openBlockchain(page: Page): Promise<Locator> {
	const panel = page.locator('orc-index-subsection-dashboard-bitcoin-enabled-blockchain');
	await expect(panel).toBeVisible();
	return panel;
}

/** The left block — `is_template = true`. First `orc-bitcoin-general-block`
 *  in DOM order inside the panel. */
function templateBlock(panel: Locator): Locator {
	return panel.locator('orc-bitcoin-general-block').first();
}

/** The right block — the confirmed tip. Second `orc-bitcoin-general-block`. */
function confirmedBlock(panel: Locator): Locator {
	return panel.locator('orc-bitcoin-general-block').nth(1);
}

/** Strip everything except digits. Works for "113", "1 txs", "249 B", etc. */
function digitsFrom(text: string): number {
	return parseInt(text.replace(/\D/g, ''), 10);
}

test.describe('bitcoin-blockchain panel', {tag: '@canary'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/');
	});

	test('renders the panel with both block cards and the divider', async ({page}) => {
		const panel = await openBlockchain(page);
		await expect(panel.locator('orc-bitcoin-general-block')).toHaveCount(2);
		await expect(panel.locator('.blockchain-divider')).toBeVisible();
	});

	test('flash container (#flash / .blockchain-blocks-container) is present', async ({page}) => {
		// The container is the element the `animateFlash()` effect targets on
		// block_height changes. Its presence is the wire — the animation
		// itself is timing-sensitive and not asserted here.
		const panel = await openBlockchain(page);
		await expect(panel.locator('.blockchain-blocks-container')).toBeVisible();
	});

	test('arrow indicator class matches `getTargetBlock()` applied to the live payloads', async ({page}) => {
		// Mirrors the component's `getTargetBlock()` against the same GraphQL
		// payloads it consumes: `.pool-block` iff both feerate values are
		// truthy AND estimate ≤ template-low; `.next-block` otherwise. A
		// reload is the simplest way to rehydrate both queries after the
		// beforeEach navigation has already settled.
		const readJsonAfterResponse = async (name: string): Promise<Record<string, unknown>> => {
			const response: Response = await page.waitForResponse(matchGql(name));
			const body = (await response.json()) as {data: Record<string, unknown>};
			return body.data;
		};
		const [, templateData, feeData] = await Promise.all([
			page.reload(),
			readJsonAfterResponse('bitcoin_block_template'),
			readJsonAfterResponse('bitcoin_transaction_fee_estimates'),
		]);
		const template = templateData.bitcoin_block_template as {feerate_low?: number | null} | null;
		const estimates = feeData.bitcoin_transaction_fee_estimates as Array<{feerate?: number | null}> | null;
		const feerate = estimates?.[0]?.feerate ?? 0;
		const feerate_low = template?.feerate_low ?? 0;
		const is_pool_block = !!feerate && !!feerate_low && feerate <= feerate_low;

		const panel = await openBlockchain(page);
		const indicator = panel.locator('.block-indicator');
		// The outer `.block-indicator` is a zero-width absolutely-positioned
		// div; Playwright's `toBeVisible` fails it. The mat-icon child has
		// real dimensions and is the visually meaningful marker.
		await expect(indicator).toBeAttached();
		await expect(indicator.locator('mat-icon')).toBeVisible();
		if (is_pool_block) {
			await expect(indicator).toHaveClass(/\bpool-block\b/);
			await expect(indicator).not.toHaveClass(/\bnext-block\b/);
		} else {
			await expect(indicator).toHaveClass(/\bnext-block\b/);
			await expect(indicator).not.toHaveClass(/\bpool-block\b/);
		}
	});

	test('confirmed block header shows the tip height from bitcoind', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const panel = await openBlockchain(page);
		const header = confirmedBlock(panel).locator('.block-height');
		const displayed = (await header.textContent())?.trim() ?? '';
		expect(digitsFrom(displayed)).toBe(btc.blockCount(config));
	});

	test('confirmed block renders byte size and tx count matching bitcoind', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const hash = btc.getBestBlockHash(config);
		const block = btc.getBlock(config, hash) as {size: number; nTx: number};

		const panel = await openBlockchain(page);
		const card = confirmedBlock(panel);

		const size_text = (await card.locator('.block-size').textContent())?.trim() ?? '';
		expect(size_text).toBe(formatBytes(block.size));

		const tx_text = (await card.locator('.block-tx-count').textContent())?.trim() ?? '';
		expect(digitsFrom(tx_text)).toBe(block.nTx);
	});

	test('template block renders the "~10 min" next-block label', async ({page}) => {
		// The `is_template = true` branch of `orc-bitcoin-general-block`
		// prints "~10 min" instead of a relative timestamp. Asserting this
		// catches regressions where the two cards swap positions in the
		// parent's flex row, which would put the relative-time label on the
		// left and misrepresent "which block is the next one".
		const panel = await openBlockchain(page);
		const template = templateBlock(panel);
		await expect(template.locator('.block-time').getByText('~10 min', {exact: true})).toBeVisible();
	});

	test('regtest mempool is empty — no backup half-block appears', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const mempool = btc.getRawMempool(config) as Record<string, unknown>;
		test.skip(Object.keys(mempool).length > 0, 'mempool non-empty — skipping the empty-path assertion');

		// `mempool_depth` is computed once in ngOnInit from the mempool
		// snapshot at mount; if ceil(sum(weight) / 4MWU) is <= 1, the
		// gradient half-block is NOT rendered to the left of the template.
		// This selects the half-block that only appears when mempool_depth > 1;
		// `.block-chained` (right of confirmed block) is always rendered
		// and is excluded from this count.
		const panel = await openBlockchain(page);
		await expect(panel.locator('.block-half.block-template')).toHaveCount(0);
	});

	test('chained gradient half is always rendered to the right of the tip', async ({page}) => {
		// `.block-half.block-chained` has no render gate — it represents
		// "there is more chain to the right" visually. Its absence would
		// mean the confirmed block is floating at the edge with no context.
		const panel = await openBlockchain(page);
		await expect(panel.locator('.block-half.block-chained')).toBeVisible();
	});
});
