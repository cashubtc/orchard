/**
 * Lightning source-of-truth reads via `lncli` (LND) or `lightning-cli` (CLN)
 * in the orchard-side LN container. Most calls are cached; balances move
 * mid-test and stay uncached.
 */

/* Native Dependencies */
import {lndCliJson, clnCliJson} from './docker-cli';
import {cached} from './_cache';
import {containerForNode, isLnd, lndDirForNode} from '@e2e/helpers/config';
import type {ConfigInfo, LnNode} from '@e2e/types/config';

function countChannels(
	config: ConfigInfo,
	node: LnNode,
	opts: {activeOnly?: boolean},
	predicate: (channel: {custom_channel_data?: string}) => boolean,
): number {
	if (!isLnd(config, node)) {
		throw new Error(`channel counting only implemented for LND nodes (got ${config.ln})`);
	}
	const container = containerForNode(config, node);
	const args = ['listchannels'];
	if (opts.activeOnly) args.push('--active_only');
	const listed = lndCliJson<{channels: Array<{custom_channel_data?: string}>}>(container, args, lndDirForNode(config, node));
	return listed.channels.filter(predicate).length;
}

/** LN reads — dispatches to lncli or lightning-cli based on config.ln. */
export const ln = {
	getInfo(config: ConfigInfo, node: LnNode = 'orchard'): Record<string, unknown> {
		return cached(`ln.getInfo:${config.name}:${node}`, () => {
			const container = containerForNode(config, node);
			return isLnd(config, node)
				? lndCliJson(container, ['getinfo'], lndDirForNode(config, node))
				: clnCliJson(container, ['getinfo']);
		});
	},

	/**
	 * Total on-chain wallet sats for the named node. Matches what Orchard's
	 * `lightning_wallet` resolver aggregates (sum of addresses' balances) —
	 * channel-committed funds live elsewhere.
	 */
	onchainSats(config: ConfigInfo, node: LnNode = 'orchard'): number {
		return cached(`ln.onchainSats:${config.name}:${node}`, () => {
			const container = containerForNode(config, node);
			if (isLnd(config, node)) {
				const bal = lndCliJson<{total_balance: string}>(container, ['walletbalance'], lndDirForNode(config, node));
				return parseInt(bal.total_balance, 10);
			}
			const funds = clnCliJson<{outputs: {amount_msat: number}[]}>(container, ['listfunds']);
			return funds.outputs.reduce((sum, o) => sum + Math.floor(Number(o.amount_msat) / 1000), 0);
		});
	},

	/** Count of addresses on the orchard node's LN wallet that carry a non-zero
	 *  balance. Mirrors the bitcoin-general-wallet-summary card's UTXO count
	 *  (`row.utxos`), which the component derives from
	 *  `lightning_accounts().flatMap(a => a.addresses).filter(b > 0).length` —
	 *  i.e. the same `ListAddresses` data the server's
	 *  `LightningWalletKitService.getLightningAddresses()` returns, mapped from
	 *  the LN node's wallet directly. The label says "UTXO" but the underlying
	 *  unit is "funded address" — multiple UTXOs at one address aggregate to
	 *  one row. Cached: addresses are append-only and the regtest fixtures
	 *  don't move funds between addresses mid-test.
	 *
	 *  LND: `lncli wallet addresses list` (the CLI form of the same RPC the
	 *  server uses), flatten all accounts' addresses, count `balance > 0`.
	 *  CLN: `lightning-cli listfunds.outputs` filtered by `status === 'confirmed'`,
	 *  count distinct `address` — server-side `mapClnAddresses` builds a
	 *  per-address sum from the same outputs and the resulting addresses-with-
	 *  positive-balance match the distinct address count exactly. */
	fundedAddressCount(config: ConfigInfo): number {
		if (config.ln === false) throw new Error(`no LN on ${config.name}`);
		return cached(`ln.fundedAddressCount:${config.name}`, () => {
			const container = config.containers.lnOrchard;
			if (config.ln === 'lnd') {
				const out = lndCliJson<{
					account_with_addresses: Array<{addresses: Array<{balance?: string}>}>;
				}>(container, ['wallet', 'addresses', 'list'], lndDirForNode(config, 'orchard'));
				return out.account_with_addresses.flatMap((a) => a.addresses).filter((x) => parseInt(x.balance ?? '0', 10) > 0).length;
			}
			const funds = clnCliJson<{outputs: Array<{address?: string; status?: string}>}>(container, ['listfunds']);
			const distinct = new Set(funds.outputs.filter((o) => o.status === 'confirmed' && !!o.address).map((o) => o.address!));
			return distinct.size;
		});
	},

	/** Local channel balance (sats) on the orchard-side LN node, summed across
	 *  open NON-asset channels. Matches what `orc-mint-general-balance-sheet`
	 *  displays in the bitcoin row's assets cell — its
	 *  `lightning_balance.open.local_balance`, which Orchard's `buildChannelSummary`
	 *  computes by filtering `channels.filter((c) => c.asset === null)` then
	 *  summing each channel's `local_balance`. NOT cached: channel balances
	 *  move whenever a payment routes through the node mid-test.
	 *
	 *  LND: `lncli listchannels` rows where `custom_channel_data` is empty (the
	 *  same non-asset filter `parseLndCustomChannelData` uses upstream). Note we
	 *  do NOT use `lncli channelbalance` — it aggregates ALL channels including
	 *  asset ones, which inflates the value on tapd-enabled stacks.
	 *  CLN: per-channel `floor(to_us_msat / 1000)` summed across
	 *  `listpeerchannels` rows in `CHANNELD_NORMAL`. The truncate-per-channel
	 *  step matters — `mapClnChannels` does `BigInt(to_us_msat) / 1000n` per
	 *  row (BigInt integer division ⇒ floor) before summing, and the channel
	 *  summary card sums those already-truncated sat values. Summing in msat
	 *  first and truncating once at the end over-counts by up to 1 sat per
	 *  channel with non-msat-aligned balances, which is enough to push the
	 *  oracle USD-cents differential off by 1 cent on multi-channel fixtures.
	 *
	 *  `activeOnly` narrows to the channels Orchard maps as active — LND
	 *  `--active_only`, CLN `peer_connected` (as `mapClnChannels` does). */
	localChannelBalance(config: ConfigInfo, opts: {activeOnly?: boolean} = {}): number {
		if (config.ln === false) throw new Error(`no LN on ${config.name}`);
		const container = config.containers.lnOrchard;
		if (config.ln === 'lnd') {
			const args = ['listchannels'];
			if (opts.activeOnly) args.push('--active_only');
			const lc = lndCliJson<{channels: Array<{local_balance?: string; custom_channel_data?: string}>}>(
				container,
				args,
				lndDirForNode(config, 'orchard'),
			);
			return lc.channels
				.filter((c) => !c.custom_channel_data || c.custom_channel_data === '')
				.reduce((sum, c) => sum + parseInt(c.local_balance ?? '0', 10), 0);
		}
		// cln — truncate per channel to match `mapClnChannels`' BigInt division.
		const lpc = clnCliJson<{channels: Array<{state: string; to_us_msat: number; peer_connected?: boolean}>}>(container, [
			'listpeerchannels',
		]);
		return lpc.channels
			.filter((c) => c.state === 'CHANNELD_NORMAL' && (!opts.activeOnly || !!c.peer_connected))
			.reduce((sum, c) => sum + Math.floor(Number(c.to_us_msat ?? 0) / 1000), 0);
	},

	/** Remote channel balance (sats) on the orchard-side LN node, summed across
	 *  open NON-asset channels. Mirror of `localChannelBalance` — used by the
	 *  channel summary's oracle-card "Remote capacity" differential. NOT cached:
	 *  same payment-flow rationale as `localChannelBalance`.
	 *
	 *  LND: `lncli listchannels` non-asset rows, sum `remote_balance`.
	 *  CLN: per-channel `floor((total_msat - to_us_msat) / 1000)` summed across
	 *  `CHANNELD_NORMAL` rows — same per-channel-truncate rationale as
	 *  `localChannelBalance`. */
	remoteChannelBalance(config: ConfigInfo): number {
		if (config.ln === false) throw new Error(`no LN on ${config.name}`);
		const container = config.containers.lnOrchard;
		if (config.ln === 'lnd') {
			const lc = lndCliJson<{channels: Array<{remote_balance?: string; custom_channel_data?: string}>}>(
				container,
				['listchannels'],
				lndDirForNode(config, 'orchard'),
			);
			return lc.channels
				.filter((c) => !c.custom_channel_data || c.custom_channel_data === '')
				.reduce((sum, c) => sum + parseInt(c.remote_balance ?? '0', 10), 0);
		}
		const lpc = clnCliJson<{channels: Array<{state: string; total_msat: number; to_us_msat: number}>}>(container, ['listpeerchannels']);
		return lpc.channels
			.filter((c) => c.state === 'CHANNELD_NORMAL')
			.reduce((sum, c) => sum + Math.floor((Number(c.total_msat ?? 0) - Number(c.to_us_msat ?? 0)) / 1000), 0);
	},

	/** Total capacity (sats) across the orchard node's open NON-asset channels.
	 *  Mirrors the channel summary card's sat-row `size` aggregation: the sum of
	 *  `channel.capacity` for `summary_type === 'open'`, or only the active
	 *  channels for `'active'`. Cached — capacity is fixed at channel-open time
	 *  and the regtest fixtures don't open new channels mid-run.
	 *
	 *  LND: `lncli listchannels` (or `--active_only`), filter empty
	 *  `custom_channel_data`, sum `capacity`. CLN: sum `total_msat` across
	 *  `CHANNELD_NORMAL` rows in `listpeerchannels` (filtered by
	 *  `peer_connected` for `activeOnly`), then /1000. */
	satChannelCapacity(config: ConfigInfo, opts: {activeOnly?: boolean} = {}): number {
		if (config.ln === false) throw new Error(`no LN on ${config.name}`);
		return cached(`ln.satChannelCapacity:${config.name}:${!!opts.activeOnly}`, () => {
			const container = config.containers.lnOrchard;
			if (config.ln === 'lnd') {
				const args = ['listchannels'];
				if (opts.activeOnly) args.push('--active_only');
				const lc = lndCliJson<{channels: Array<{capacity?: string; custom_channel_data?: string}>}>(
					container,
					args,
					lndDirForNode(config, 'orchard'),
				);
				return lc.channels
					.filter((c) => !c.custom_channel_data || c.custom_channel_data === '')
					.reduce((sum, c) => sum + parseInt(c.capacity ?? '0', 10), 0);
			}
			const lpc = clnCliJson<{channels: Array<{state: string; total_msat: number; peer_connected?: boolean}>}>(
				container,
				['listpeerchannels'],
			);
			let normal = lpc.channels.filter((c) => c.state === 'CHANNELD_NORMAL');
			if (opts.activeOnly) normal = normal.filter((c) => !!c.peer_connected);
			// Truncate per channel to match `mapClnChannels`' BigInt division —
			// same rationale as `localChannelBalance` / `remoteChannelBalance`.
			// (Capacity is normally msat-aligned at open time so this is
			// usually a no-op, but consistency is cheap and safe.)
			return normal.reduce((sum, c) => sum + Math.floor(Number(c.total_msat ?? 0) / 1000), 0);
		});
	},

	/** Closed sat-channel count on the orchard node. Mirrors what Orchard's
	 *  `lightning_closed_channels` resolver returns (filtered to non-asset
	 *  channels for parity with the channel summary card's sat row). Cached —
	 *  closures are append-only and the fixtures never close channels.
	 *
	 *  LND: `lncli closedchannels`, count rows with empty `custom_channel_data`.
	 *  CLN: `lightning-cli listclosedchannels`, count `closedchannels` array
	 *  (CLN has no asset-channel concept). */
	closedChannelCount(config: ConfigInfo): number {
		if (config.ln === false) throw new Error(`no LN on ${config.name}`);
		return cached(`ln.closedChannelCount:${config.name}`, () => {
			const container = config.containers.lnOrchard;
			if (config.ln === 'lnd') {
				const cc = lndCliJson<{channels: Array<{custom_channel_data?: string}>}>(
					container,
					['closedchannels'],
					lndDirForNode(config, 'orchard'),
				);
				return cc.channels.filter((c) => !c.custom_channel_data || c.custom_channel_data === '').length;
			}
			const lcc = clnCliJson<{closedchannels: unknown[]}>(container, ['listclosedchannels']);
			return (lcc.closedchannels ?? []).length;
		});
	},

	/** Count of the node's channels that do NOT carry taproot-asset metadata.
	 *  Mirrors the orc-lightning-general-channel-summary component's sat-row
	 *  filter (channels with empty `custom_channel_data`). LND only — CLN has
	 *  no asset-channel concept. */
	satChannelCount(config: ConfigInfo, node: LnNode = 'orchard', opts: {activeOnly?: boolean} = {}): number {
		return cached(`ln.satChannelCount:${config.name}:${node}:${!!opts.activeOnly}`, () =>
			countChannels(config, node, opts, (c) => !c.custom_channel_data || c.custom_channel_data === ''),
		);
	},

	/** Count of the node's channels that DO carry taproot-asset metadata
	 *  (non-empty `custom_channel_data`). Mirrors the tapass-row filter in
	 *  orc-lightning-general-channel-summary. LND-only (integrated tapd). */
	assetChannelCount(config: ConfigInfo, node: LnNode = 'orchard', opts: {activeOnly?: boolean} = {}): number {
		return cached(`ln.assetChannelCount:${config.name}:${node}:${!!opts.activeOnly}`, () =>
			countChannels(config, node, opts, (c) => !!c.custom_channel_data && c.custom_channel_data !== ''),
		);
	},

	/** Sat-row channel count as the dashboard's channel-summary card sees it.
	 *  Dispatches lnd → `satChannelCount` (filters by `custom_channel_data`);
	 *  cln → getinfo's `num_active_channels (+ num_inactive_channels)` because
	 *  cln has no asset-channel concept. */
	openSatChannelCount(config: ConfigInfo, opts: {activeOnly?: boolean} = {}): number {
		if (config.ln === 'lnd') return ln.satChannelCount(config, 'orchard', opts);
		const info = ln.getInfo(config) as {num_active_channels?: number; num_inactive_channels?: number};
		const active = info.num_active_channels ?? 0;
		if (opts.activeOnly) return active;
		return active + (info.num_inactive_channels ?? 0);
	},

	/** Normalized "is this LN node fully synced" boolean, matching what
	 *  `orc-lightning-general-info`'s `state` computed renders:
	 *    state = error ? 'offline' : (synced ? 'online' : 'syncing')
	 *
	 *  LND emits `synced_to_chain` / `synced_to_graph` directly. CLN has no
	 *  such field — sync state is encoded as the *absence* of the
	 *  `warning_lightningd_sync` / `warning_bitcoind_sync` fields on getinfo.
	 *
	 *  On regtest LND, `synced_to_chain` flips false when no fresh blocks
	 *  have been mined recently (no continuous block flow), so this helper
	 *  legitimately returns false on idle LND stacks. CLN's regtest behavior
	 *  is gentler — its sync warnings only fire on real desync, not idle. */
	synced(config: ConfigInfo, node: LnNode = 'orchard'): boolean {
		const info = ln.getInfo(config, node);
		if (isLnd(config, node)) {
			const i = info as {synced_to_chain?: boolean; synced_to_graph?: boolean};
			return !!i.synced_to_chain && !!i.synced_to_graph;
		}
		const i = info as {warning_lightningd_sync?: string | null; warning_bitcoind_sync?: string | null};
		return !i.warning_lightningd_sync && !i.warning_bitcoind_sync;
	},
};
