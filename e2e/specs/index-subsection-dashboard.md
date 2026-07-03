# `orc-index-subsection-dashboard`

Source: [index-subsection-dashboard.component.ts](../../src/client/modules/index/modules/index-subsection-dashboard/components/index-subsection-dashboard/index-subsection-dashboard.component.ts) · [`.html`](../../src/client/modules/index/modules/index-subsection-dashboard/components/index-subsection-dashboard/index-subsection-dashboard.component.html)

## Purpose

The home route (`/`) — a four-row dashboard (Bitcoin, Lightning, Mint, Ecash), each row a sticky section header plus an enabled/disabled tile body. It orchestrates every top-level backend read (bitcoin blockchain/network/mempool/fees + polling, lightning info/balance/channels, tapd, mint info/balances/keysets/activity/icon) and fans the results into the per-section card components. It is the mount point for the already-spec'd cards (`orc-bitcoin-general-info`, `orc-lightning-general-info`, `orc-mint-general-info`, etc.).

This spec covers the **page-level contract** — which tile (enabled vs disabled) each section renders per stack, the four section headers, the always-disabled Ecash row, and the disabled tiles' navigate buttons. The card internals are covered by their own specs and are not re-asserted here.

## Where it renders

- Lazy child route `''` of the index section ([routing.module.ts:20-24](../../src/client/modules/routing/routing.module.ts#L20)); guarded by `initializationGuard` + `authenticationGuard` only. No per-section enable guard — the page itself decides which tile to show from runtime config.
- Enable flags read once in the constructor: `enabled_bitcoin`/`enabled_lightning`/`enabled_mint` from `configService.config.*.enabled`; `enabled_taproot_assets`; `enabled_bitcoin_oracle` from the app setting; `enabled_ecash` is hard-coded `false`.

## Inputs

Route-mounted, none. Feeds children via bound properties (see the card specs for each).

## Outputs & projected content

None. Disabled tiles emit `(navigate)` → `onNavigate(route)` → `router.navigate(['/<route>'])`.

## Derived / computed signals

- `device_type` — BreakpointObserver (mobile/tablet/desktop); toggles `.tablet-view` on the container.
- `preparing_bitcoin` / `preparing_lightning` / `preparing_mint` getters — true while the section's loads are in flight or errored; passed to headers/tiles as `loading`.

## Happy path

1. Authenticated user lands on `/`. Constructor reads enable flags; `orchardOptionalInit` fires each enabled section's loads (skipping disabled ones — `loading_* = false` when disabled).
2. Four section headers render immediately (Bitcoin, Lightning, Mint, Ecash titles).
3. Each row renders its `-enabled` tile (if the backend is wired) or its `-disabled` tile (a stroked "… Configuration" button, except Ecash which always shows "Ecash Wallet Coming Soon!").
4. Enabled tiles hydrate as their forkJoins resolve; bitcoin polls blockchain info every 5s until synced.

## Reachable states

### 1. Bitcoin row — enabled vs disabled

`enabled_bitcoin` true → `orc-index-subsection-dashboard-bitcoin-enabled`. False → `orc-index-subsection-dashboard-bitcoin-disabled` with a "Bitcoin Configuration" stroked button emitting `navigate` → `/bitcoin`. Enabled on all four backed stacks; disabled on `fake-cdk-postgres` (`BITCOIN_TYPE` absent).

### 2. Lightning row — enabled vs disabled

`enabled_lightning` → `-lightning-enabled` / `-lightning-disabled` ("Lightning Configuration" → `/lightning`). Disabled on `fake-cdk-postgres`.

### 3. Mint row — enabled vs disabled

`enabled_mint` → `-mint-enabled` / `-mint-disabled` ("Mint Configuration" → `/mint`). Every shipped stack wires a mint, so the disabled tile is not reachable on the current matrix (dead-branch here; documented, not tested).

### 4. Ecash row — always disabled

`enabled_ecash` is hard-coded `false`, so `orc-index-subsection-dashboard-ecash-disabled` ("Ecash Wallet Coming Soon!") renders on every stack; the `-ecash-enabled` branch is currently unreachable.

### 5. Section headers

Four `-header` components render their title (`Bitcoin` / `Lightning` / `Mint` / `Ecash`). The bitcoin header additionally shows `network_info.subversion` when enabled + loaded; the ecash header is static (payments icon + "Ecash").

### 6. Bitcoin error surface

`errors_bitcoin.length > 0` renders `orc-error-resolve` rows below the tile. Same pattern for lightning / tapd / mint. Disruptive to reproduce (needs a backend fault).

### 7. Device variants

`.tablet-view` on non-desktop; headers switch to `.tablet-header`. Card-level column changes are covered per-card.

## Child components

The enabled tiles are thin layout wrappers around the already-spec'd general cards:

- Bitcoin enabled → `orc-bitcoin-general-info`, `-wallet-summary`, `-block`/`-syncing`, treemap/utxo (see bitcoin card specs).
- Lightning enabled → `orc-lightning-general-info`, `-channel-summary`.
- Mint enabled → `orc-mint-general-info`, `-activity`, `-balance-sheet`.

Disabled tiles are trivial: a single stroked button (bitcoin/lightning/mint) or a static string (ecash). Their only behaviour is the `navigate` output.

## Unhappy / edge cases

- All-disabled stack (`fake-cdk-postgres`): bitcoin + lightning show disabled tiles; mint stays enabled (fake stack still runs cdk-mintd); ecash disabled. This is the one stack that exercises the disabled tiles for bitcoin/lightning.
- A section's forkJoin error leaves its tile in `loading`/error and appends `orc-error-resolve` rows; other sections are unaffected (independent subscriptions).
- Bitcoin polling stops permanently on the first blockchain-info error (`bitcoin_polling_active = false`) — a transient RPC blip halts live block updates until reload.

## Template structure (at a glance)

```
orc-index-subsection-dashboard  (.tablet-view when !desktop)
├─ bitcoin-header      → @if(enabled_bitcoin) bitcoin-enabled @else bitcoin-disabled  (+ error rows)
├─ lightning-header    → @if(enabled_lightning) lightning-enabled @else lightning-disabled  (+ error rows)
├─ mint-header         → @if(enabled_mint) mint-enabled @else mint-disabled  (+ error rows)
└─ ecash-header        → @if(enabled_ecash=false) … @else ecash-disabled  ("Ecash Wallet Coming Soon!")
```

## Interaction summary

| Gesture | Target | Result |
|---|---|---|
| Click | "Bitcoin Configuration" (disabled tile) | `navigate` → `/bitcoin` |
| Click | "Lightning Configuration" (disabled tile) | `navigate` → `/lightning` |
| Click | "Mint Configuration" (disabled tile) | `navigate` → `/mint` |
| (card gestures) | enabled tiles | covered per-card |

## Test-author handoff

### Host page + setup

- `page.goto('/')`; storageState auth; settle on the first section header visible.
- Tag: `@all` — the whole point is the per-stack tile matrix; the disabled tiles only appear on `fake-cdk-postgres`, so the spec must run everywhere to see both sides.

### Differential oracles

| Surface | Oracle |
|---|---|
| Bitcoin tile enabled/disabled | `config.bitcoin` ([helpers/config.ts](../helpers/config.ts)) |
| Lightning tile enabled/disabled | `config.ln !== false` |
| Mint tile enabled | always true on current matrix (`config.mint` set) |
| Ecash tile | always disabled (hard-coded) |
| Bitcoin header subversion | `btc.getNetworkInfo`/`subversion` if asserted — skipped here (bitcoin card spec owns it) |

### State reachability matrix

| State | lnd-nutshell-sqlite | lnd-cdk-sqlite | cln-cdk-postgres | cln-nutshell-postgres | fake-cdk-postgres |
|---|---|---|---|---|---|
| 1. Bitcoin enabled | ✓ live | ✓ live | ✓ live | ✓ live | — |
| 1. Bitcoin disabled | — | — | — | — | ✓ live |
| 2. Lightning enabled | ✓ live | ✓ live | ✓ live | ✓ live | — |
| 2. Lightning disabled | — | — | — | — | ✓ live |
| 3. Mint enabled | ✓ live | ✓ live | ✓ live | ✓ live | ✓ live |
| 3. Mint disabled | — | — | — | — | — (dead-branch) |
| 4. Ecash disabled | ✓ live | ✓ live | ✓ live | ✓ live | ✓ live |
| 5. Section headers | ✓ live | ✓ live | ✓ live | ✓ live | ✓ live |
| 6. Error surface | — disruptive | — | — | — | — |

### Per-state probes

| State | Settled signal | Primary assert |
|---|---|---|
| 1 enabled | `orc-index-subsection-dashboard-bitcoin-enabled` visible | exactly one enabled tile, zero disabled |
| 1 disabled | `orc-index-subsection-dashboard-bitcoin-disabled` visible | "Bitcoin Configuration" button; click → URL `/bitcoin` |
| 2 enabled/disabled | mirror of 1 for lightning | — |
| 3 enabled | `orc-index-subsection-dashboard-mint-enabled` visible | present on every stack |
| 4 ecash | `orc-index-subsection-dashboard-ecash-disabled` visible | "Ecash Wallet Coming Soon!"; zero `-ecash-enabled` |
| 5 headers | header components visible | titles Bitcoin/Lightning/Mint/Ecash all present |

### Reusable interaction recipes

- Navigate-button assertion: click the disabled tile's button, `await expect(page).toHaveURL(...)`, then `goBack()` to restore.
- Stack-conditional branch: `const config = getConfig(testInfo.project.name); if (config.bitcoin) {…} else {…}` — same idiom as the disabled-subsections spec.

### Skip taxonomy

- State 3 disabled (mint): `dead-branch` — no shipped stack runs mint-less; documented only.
- State 6 (error surface): `disruptive` — requires a backend fault.
- Enabled-tile internals: covered by the per-card specs; asserting here would duplicate and add flake surface.

## Test fidelity hooks

- No prior `index-subsection-dashboard.spec.ts` at the page level (the cards have their own specs).
- Planned: tile enabled/disabled per section (1–4), navigate buttons, section headers (5).
- Skipped: mint-disabled (dead-branch), error surface (disruptive), card internals (owned elsewhere).

## Notes for implementers

- Ecash is permanently disabled via the hard-coded `enabled_ecash = false` — when the wallet ships, states 4 and the ecash card need real coverage; this spec's ecash assertions become the tripwire.
- The disabled tiles are the only page-level UI unique to `fake-cdk-postgres`; keep them cheap and their button labels stable — they double as the "backend absent" operator affordance.
- Section subscriptions are independent: one backend down should never blank a healthy sibling section. A regression that couples them would surface as an unexpected disabled/loading tile on a backed stack.
