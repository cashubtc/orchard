# `orc-bitcoin-subsection-dashboard`

Source: [bitcoin-subsection-dashboard.component.ts](../../src/client/modules/bitcoin/modules/bitcoin-subsection-dashboard/components/bitcoin-subsection-dashboard/bitcoin-subsection-dashboard.component.ts) · [`.html`](../../src/client/modules/bitcoin/modules/bitcoin-subsection-dashboard/components/bitcoin-subsection-dashboard/bitcoin-subsection-dashboard.component.html)

## Purpose

The routed body of `/bitcoin`. A **placeholder stub**: a `bitcoin` svg-icon and "Bitcoin Dashboard Coming Soon!". Empty component class. The testable surface is the host wrapper `orc-bitcoin-section`, which fetches blockchain + network info and renders the secondary-nav chrome: chain name, node subversion, a "Dashboard" nav item, a **conditional "Oracle" nav item** (when the bitcoin oracle app-setting is on), a route-change overlay spinner, and the shared more-menu.

The bitcoin data cards (`orc-bitcoin-general-info`, `-block`, `-treemap`, `-utxo-stack`, `-wallet-summary`, `-syncing`) render on the index dashboard `/`, NOT here — they are covered by their own specs and the index page spec.

## Where it renders

- Lazy child route `''` of [`bitcoin-section.module.ts`](../../src/client/modules/bitcoin/modules/bitcoin-section/bitcoin-section.module.ts) at `/bitcoin`, `enabledGuard`-gated (bitcoin disabled → `/bitcoin/disabled`, reachable only on `fake-cdk-postgres`).
- Route title `Orchard | Bitcoin`.

## Inputs

Stub takes none. Section wrapper feeds itself from `BitcoinService` (blockchain + network info signals).

## Derived / computed signals (wrapper: `orc-bitcoin-section`)

- `active_sub_section` — router-derived; `'dashboard'` on `/bitcoin`, `'oracle'` on `/bitcoin/oracle`.
- `bitcoin_blockchain_info` / `bitcoin_network_info` — signals; header binds `.chain` and `.subversion`.
- `overlayed` — true during bitcoin route transitions; shows a `mat-progress-spinner` overlay.
- `show_oracle` — from the `bitcoin_oracle` app setting; gates the Oracle nav item.

## Happy path

1. Navigate to `/bitcoin`. `enabledGuard` passes on every bitcoin-backed stack.
2. Section chrome renders: `deployed_code` icon + chain name (`regtest` on the e2e stacks), node subversion (`/Satoshi:30.0.0/`) in the toolbar, "Dashboard" nav item highlighted.
3. If `show_oracle`, an "Oracle" nav item renders alongside Dashboard.
4. Stub body: `bitcoin` svg-icon + "Bitcoin Dashboard Coming Soon!".

## Reachable states

### 1. Stub populated (only body state)

`.bitcoin-dashboard-container` with one svg `mat-icon[svgIcon=bitcoin]` + static text. Invariant across stacks.

### 2. Header populated

Chain from `bitcoin_blockchain_info.chain` (`regtest`); subversion from `bitcoin_network_info.subversion` (`/Satoshi:30.0.0/`). Both differential via `btc.getBlockchainInfo` / `btc.getNetworkInfo`.

### 3. Oracle nav item shown / hidden

`show_oracle` true → two nav items (Dashboard, Oracle). False → Dashboard only. Config-state: on for `cln-nutshell-postgres` (`@oracle`), off elsewhere.

### 4. Route overlay spinner

`overlayed()` true during a `/bitcoin/*` route transition → `mat-progress-spinner` in `.orc-route-overlay`. Transient.

### 5. Disabled redirect

`config.bitcoin.enabled === false` → redirect to `/bitcoin/disabled`; stub never mounts. Stack-only: `fake-cdk-postgres` (covered by disabled-subsections spec).

### 6. More-menu

`orc-nav-secondary-more` → single Logout item (same contract as [lightning-subsection-dashboard.md](lightning-subsection-dashboard.md)).

## Child components

- `orc-nav-secondary-item` ("Dashboard", "Oracle") — router links; Dashboard `navroute="bitcoin"` (correct here, unlike the lightning section's bug), Oracle `navroute="bitcoin/oracle"`.
- `orc-nav-secondary-more` — Logout menu.

## Unhappy / edge cases

- Pre-resolve: chain/subversion render empty (optional-chained) until the info signals populate.
- `bitcoin_network_info` error leaves subversion blank; no error surface on the chrome.

## Template structure (at a glance)

```
orc-bitcoin-section
├─ orc-nav-secondary
│  ├─ [header]  deployed_code icon + chain
│  ├─ [items]   Dashboard · @if(show_oracle) Oracle
│  └─ [toolbar] subversion + more-menu (Logout)
└─ .subsection-container
   ├─ @if(overlayed) route-overlay spinner
   └─ router-outlet → orc-bitcoin-subsection-dashboard (svg bitcoin icon + stub text)
```

## Interaction summary

| Gesture | Target | Result |
|---|---|---|
| Click | "Dashboard" nav item | stays on `/bitcoin` |
| Click | "Oracle" nav item (when shown) | navigates `/bitcoin/oracle` |
| Click | more-menu → Logout | revokes token → `/auth` (disruptive) |

## Test-author handoff

### Host page + setup

- `page.goto('/bitcoin')`; storageState; settle on the section header visible.
- Tag: `@bitcoin` (needs bitcoind → runs on the four backed stacks); the Oracle nav item test additionally keys on `config.mainchain`/`@oracle` (only `cln-nutshell-postgres`).

### Differential oracles

| Surface | Oracle |
|---|---|
| Chain | `btc.getBlockchainInfo(config).chain` ([backend/btc.ts](../helpers/backend/btc.ts)) — `regtest`. **Caveat**: on `cln-nutshell-postgres` Orchard is wired to a real mainnet bitcoind (the `compose.mainchain.yml` overlay), so the UI reports `main` while the helper reads the regtest container. Assert non-empty on mainchain, differential elsewhere. |
| Subversion | `btc.getNetworkInfo(config).subversion` — same mainchain caveat (assert non-empty on `config.mainchain`). |
| Oracle nav item | `config.mainchain` (the stack whose settings matrix turns `bitcoin_oracle` on) |
| Stub text/icon | static |

### State reachability matrix

| State | lnd-nutshell-sqlite | lnd-cdk-sqlite | cln-cdk-postgres | cln-nutshell-postgres | fake-cdk-postgres |
|---|---|---|---|---|---|
| 1. Stub | ✓ live | ✓ live | ✓ live | ✓ live | — (redirect) |
| 2. Header | ✓ live | ✓ live | ✓ live | ✓ live | — |
| 3. Oracle nav shown | — | — | — | ✓ live | — |
| 3. Oracle nav hidden | ✓ live | ✓ live | ✓ live | — | — |
| 4. Route overlay | — transient | — | — | — | — |
| 5. Disabled redirect | — | — | — | — | ✓ live (other spec) |
| 6. More-menu | ✓ live | ✓ live | ✓ live | ✓ live | — |

### Per-state probes

| State | Settled signal | Primary assert |
|---|---|---|
| 1 | `orc-bitcoin-subsection-dashboard .bitcoin-dashboard-container` visible | svg icon present; "Bitcoin Dashboard Coming Soon!" |
| 2 | `.nav-secondary-header .text-nowrap` non-empty | chain == oracle; `.section-implementation` == subversion oracle |
| 3 | nav items settled | Oracle item present iff `config.mainchain`; Dashboard always present |
| 4 | n/a | not tested (transient) |
| 5 | `orc-bitcoin-subsection-disabled` | URL `/bitcoin/disabled` (disabled spec) |
| 6 | menu item visible | one Logout item; Escape closes |

### Reusable interaction recipes

- Header inline text differential — same pattern as [lightning-subsection-dashboard.spec.ts](lightning-subsection-dashboard.spec.ts).
- Oracle nav conditional — key on `config.mainchain` (the `@oracle`/`@mainchain` stack).

### Skip taxonomy

- State 4 (overlay): `unit-better` — transient route-transition spinner.
- State 5 (disabled): `stack-only` — disabled-subsections spec.
- Logout click: `disruptive`.
- Bitcoin data cards (block/treemap/utxo/wallet/info): rendered on `/`, owned by their own specs — not this page.

## Test fidelity hooks

- No prior `bitcoin-subsection-dashboard.spec.ts`; first coverage of `/bitcoin` as a page.
- Planned: states 1, 2, 3, 6.
- Skipped: 4 (transient), 5 (other spec), Logout (disruptive), data cards (elsewhere).

## Notes for implementers

- When the real Bitcoin dashboard replaces the stub, the body section is obsolete; the chrome (chain/subversion/oracle-nav/overlay) survives.
- The Oracle nav item is the one piece of `/bitcoin` chrome that varies by config — it's the cheapest signal that the oracle feature is enabled for a stack.
- Unlike the lightning section, this Dashboard nav item's `navroute` is correct (`bitcoin`), so its click is safe to assert once tested.
