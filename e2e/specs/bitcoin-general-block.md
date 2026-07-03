# `orc-bitcoin-general-block`

Source: [bitcoin-general-block.component.ts](../../src/client/modules/bitcoin/modules/bitcoin-general/components/bitcoin-general-block/bitcoin-general-block.component.ts) · [`.html`](../../src/client/modules/bitcoin/modules/bitcoin-general/components/bitcoin-general-block/bitcoin-general-block.component.html)

## Purpose

The block card on the index dashboard's Bitcoin blockchain tile. Renders one block's summary — height (mined block only), min feerate + feerate range, size, tx count, relative time — plus a fee-bucket treemap child. Two instances render: the latest mined block (with `.block-height` header) and the next-block template (`is_template`, "~10 min").

## Where it renders

- [`index-subsection-dashboard-bitcoin-enabled-blockchain`](../../src/client/modules/index/modules/index-subsection-dashboard/components/index-subsection-dashboard-bitcoin-enabled-blockchain/index-subsection-dashboard-bitcoin-enabled-blockchain.component.html) on `/`, inside the Bitcoin tile.
- Only when the node is synced (blockchain tile). On regtest that's always true; the mainchain stack (`cln-nutshell-postgres`) can be mid-IBD → the syncing tile renders instead (covered by [bitcoin-syncing.spec.ts](bitcoin-syncing.spec.ts)).

## Inputs

| Input | Type | Required | Notes |
|---|---|---|---|
| `block` | `BitcoinBlock \| BitcoinBlockTemplate` | — | From the dashboard's `getBitcoinMempool` (block) / `getBitcoinBlockTemplate` (template) |
| `height` | `number` | — | Mined-block height |
| `is_template` | `boolean` | — | `true` for the next-block template instance |

## Derived / computed signals

- `treemap_rects` / `fullness` — fee-bucket geometry passed to the treemap child.

## Reachable states

### 1. Mined block card

`.block-height` header + feerate/size/tx-count/time + treemap. Height is a positive integer.

### 2. Template block card

`is_template` — no height header; time shows "~10 min"; same treemap child.

## Child components

- `orc-bitcoin-general-treemap` ([source](../../src/client/modules/bitcoin/modules/bitcoin-general/components/bitcoin-general-treemap/bitcoin-general-treemap.component.ts)): SVG fee-bucket treemap; inputs `rects` + `fullness`. Rect geometry is `unit-better` (layout pixels); presence is asserted here.

## Test-author handoff

### Host page + setup

- `page.goto('/')`; storageState; skip `config.mainchain` (may be syncing).
- Tag: `@bitcoin` (needs bitcoind; runs on the four bitcoin stacks, skips fake).

### Differential oracles

| Surface | Oracle |
|---|---|
| Block height | `btc.getBlockchainInfo(config).blocks` — **shape only** here: the regtest tip advances mid-test as the block-miner mines, so the UI legitimately lags by a block or two. Assert positivity, not an exact match. |

### State reachability matrix

| State | lnd-nutshell-sqlite | lnd-cdk-sqlite | cln-cdk-postgres | cln-nutshell-postgres | fake-cdk-postgres |
|---|---|---|---|---|---|
| 1. Mined block | ✓ live | ✓ live | ✓ live | — syncing/IBD | — no bitcoin |
| 2. Template block | ✓ live | ✓ live | ✓ live | — | — |

### Per-state probes

| State | Settled signal | Primary assert |
|---|---|---|
| 1 | `orc-bitcoin-general-block .block-height` visible | height > 0; treemap present; size + tx-count render |
| 2 | second block card | template instance renders alongside |

### Skip taxonomy

- Exact height differential: `unit-better` — moving regtest tip.
- Treemap rect geometry: `unit-better` — SVG pixels.
- Syncing branch: covered by `bitcoin-syncing.spec.ts`.

## Test fidelity hooks

- Planned: mined-block card structure + treemap presence + size/tx details (state 1).
- Skipped: exact height, treemap geometry, syncing branch, template-specific assertions.

## Notes for implementers

- This card and its treemap render real live block data on `/`; they're the visual proof the bitcoin mempool/template pipeline is feeding the dashboard. The sibling `orc-bitcoin-general-utxo-stack` is covered transitively by the wallet-summary card spec.
