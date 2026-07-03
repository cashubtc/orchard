# `orc-bitcoin-subsection-oracle`

Source: [bitcoin-subsection-oracle.component.ts](../../src/client/modules/bitcoin/modules/bitcoin-subsection-oracle/components/bitcoin-subsection-oracle/bitcoin-subsection-oracle.component.ts) · [`.html`](../../src/client/modules/bitcoin/modules/bitcoin-subsection-oracle/components/bitcoin-subsection-oracle/bitcoin-subsection-oracle.component.html)

## Purpose

The routed body of `/bitcoin/oracle` — the UTXOracle price feed. It renders the latest computed BTC/USD price (date + value), a date-range control, a "Backfill Prices" flow (collapsible form that walks a date range and computes prices from on-chain data), and a price chart. Prices persist in Orchard's own `utxoracle` table.

## Where it renders

- Lazy route `oracle` of the bitcoin section; the "Oracle" secondary-nav item and route exist only when `show_oracle` (the `bitcoin_oracle` app setting) is on **and** a real mainnet bitcoind is wired.
- On the shipped matrix that is `cln-nutshell-postgres` only (`@oracle` + `@mainchain`). Everywhere else the route/nav is absent.
- The lazy module wires `canDeactivate` on a PENDING backfill event.

## Derived / computed signals

- `latest_oracle = computed(() => data().at(-1) ?? null)` — the newest price point; drives the Latest Price value + date.
- `form_open` — collapsible backfill form state.
- `backfill_running` / `backfill_progress` — live progress during a backfill run.
- `min_date` fixed at 2020-07-27 UTC (first valid UTXOracle date); `max_date` = today UTC.

## Happy path

1. Navigate to `/bitcoin/oracle` (Oracle nav item on the bitcoin section). `oracle.setup.ts` has already backfilled yesterday, so `data()` is non-empty.
2. Latest Price shows `<date> UTC` + `$<price>` (integer USD/BTC).
3. The price chart renders the feed.
4. "Backfill Prices" FAB expands the backfill form (start date required; end auto-set). Running it computes + stores prices (owned by `oracle.setup.ts`, not re-run here).

## Reachable states

### 1. Latest Price populated

`data().length > 0`. Date label + `$price`. Differential against `orchard.oraclePrice`.

### 2. Backfill form open / closed

FAB toggles `.orc-animation-collapsible.animation-open` + `orc-bitcoin-subsection-oracle-form`.

### 3. Backfill running

`backfill_running` true → progress surfaces (`-run`, `-run-progress-date`, `-run-progress-summary`). Reached only during an actual run — owned by `oracle.setup.ts`.

### 4. Chart rendered

`orc-bitcoin-subsection-oracle-chart` canvas.

### 5. Device variants

Latest Price moves below the chart on tablet/mobile; FAB collapses to icon-only.

## Child components

- `orc-bitcoin-subsection-oracle-control`: date-range + preset picker.
- `orc-bitcoin-subsection-oracle-form`: backfill date form (start required; end disabled/auto), close/cancel.
- `orc-bitcoin-subsection-oracle-run` (+ `-run-progress-date`, `-run-progress-summary`): live backfill progress.
- `orc-bitcoin-subsection-oracle-chart`: the price line chart with a backfill-range overlay.

## Unhappy / edge cases

- Empty feed (never backfilled): Latest Price renders empty; chart empty. Gated here by `oracleHasRecentData` readiness.
- Backfill date before 2020-07-27 rejected by `min_date`.
- Backfill failure surfaces an ERROR event.

## Template structure (at a glance)

```
orc-bitcoin-subsection-oracle
├─ oracle-control (date range) · Latest Price (date UTC + $price) · Backfill Prices FAB
├─ (collapsible) orc-bitcoin-subsection-oracle-form (start date)
└─ orc-bitcoin-subsection-oracle-chart (canvas + backfill overlay)
```

## Interaction summary

| Gesture | Target | Result |
|---|---|---|
| Click | Backfill Prices FAB | Toggles backfill form |
| Set | start date + Save | Runs backfill (mutation — not exercised) |
| Change | date-range control | Rewindows the chart |
| Navigate | while backfill PENDING | Unsaved dialog |

## Test-author handoff

### Host page + setup

- `page.goto('/bitcoin/oracle')`; storageState; `requireReady(page, oracleHasRecentData)`.
- Tag: `@oracle` (config-state; matches only `cln-nutshell-postgres`, pairs with `@mainchain`).

### Differential oracles

| Surface | Oracle |
|---|---|
| Latest price value | `orchard.oraclePrice(config)` ([backend/orchard.ts](../helpers/backend/orchard.ts)) — newest `utxoracle.price` |
| Feed presence | `oracleHasRecentData` readiness ([helpers/ui/readiness.ts](../helpers/ui/readiness.ts)) |

### State reachability matrix

| State | lnd-nutshell-sqlite | lnd-cdk-sqlite | cln-cdk-postgres | cln-nutshell-postgres | fake-cdk-postgres |
|---|---|---|---|---|---|
| 1. Latest Price | — (no route) | — | — | ✓ live | — |
| 2. Backfill form | — | — | — | ✓ live | — |
| 3. Backfill running | — | — | — | — setup-only | — |
| 4. Chart | — | — | — | ✓ live | — |

### Per-state probes

| State | Settled signal | Primary assert |
|---|---|---|
| 1 | `.font-size-xxl` visible | stripped digits == `orchard.oraclePrice` |
| 2 | `orc-bitcoin-subsection-oracle-form` visible | FAB opens form; close collapses |
| 4 | chart canvas visible | canvas present |

### Reusable interaction recipes

- Readiness gate: `requireReady(page, oracleHasRecentData)` — same pattern as the analytics-sensitive mint specs.
- FAB collapsible toggle: `.click()` then assert `.animation-open`.

### Skip taxonomy

- State 3 (backfill run): `disruptive` — owned by `oracle.setup.ts`; re-running would recompute + rewrite prices.
- AI date selection: `stack-only` — needs `@ai` on this stack.

## Test fidelity hooks

- No prior `bitcoin-subsection-oracle.spec.ts`.
- Planned: states 1, 2, 4 (+ Latest Price date/UTC label).
- Skipped: 3 (setup-owned), AI.

## Notes for implementers

- The Latest Price value is the cheapest smoke test that the oracle pipeline (bitcoind → backfill → `utxoracle` table → resolver → UI) is intact end-to-end.
- `canDeactivate` blocks nav only during a PENDING backfill.
- This page is the only `@oracle`-gated route; it exists solely on the mainchain stack, so its coverage lives and dies with that stack's fixtures.
