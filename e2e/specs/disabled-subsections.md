# `orc-bitcoin-subsection-disabled` / `orc-lightning-subsection-disabled`

Source:
- Bitcoin: [bitcoin-subsection-disabled.component.ts](../../src/client/modules/bitcoin/modules/bitcoin-subsection-disabled/components/bitcoin-subsection-disabled/bitcoin-subsection-disabled.component.ts) · [`.html`](../../src/client/modules/bitcoin/modules/bitcoin-subsection-disabled/components/bitcoin-subsection-disabled/bitcoin-subsection-disabled.component.html)
- Lightning: [lightning-subsection-disabled.component.ts](../../src/client/modules/lightning/modules/lightning-subsection-disabled/components/lightning-subsection-disabled/lightning-subsection-disabled.component.ts) · [`.html`](../../src/client/modules/lightning/modules/lightning-subsection-disabled/components/lightning-subsection-disabled/lightning-subsection-disabled.component.html)

## Purpose

The "backend absent" pages. When Orchard boots without `BITCOIN_TYPE` / `LIGHTNING_TYPE`, `enabledGuard` redirects `/bitcoin` → `/bitcoin/disabled` and `/lightning` → `/lightning/disabled`. Each renders a **sample `.env` explainer** (`orc-settings-general-env`) so the operator knows exactly which variables to set. The lightning page adds a lnd/cln selector that swaps the sample config, plus a Taproot Assets sample. This is the AGENTS.md "errors are the support channel" principle made concrete: a self-hosting operator with a misconfigured stack lands here and gets a copy-pasteable config.

## Where it renders

- Only on stacks booted without the backend. On the shipped matrix that is `fake-cdk-postgres` (no `BITCOIN_TYPE`, no `LIGHTNING_TYPE`). Every other stack wires both, so `enabledGuard` never redirects and these pages are unreachable.
- Mint is enabled on `fake-cdk-postgres` (it runs cdk-mintd), so `orc-mint-subsection-disabled` is NOT reachable on the current matrix — dead-branch here.

## Inputs

Neither page takes runtime inputs; both hold hard-coded `EnvConfig` samples.

## Happy path (fake stack)

1. Operator opens `/bitcoin` on a no-bitcoin stack. `enabledGuard` redirects to `/bitcoin/disabled`.
2. `orc-bitcoin-subsection-disabled` renders one `orc-settings-general-env` with a sample bitcoin `.env`.
3. `/lightning` → `/lightning/disabled`: a lnd/cln `mat-select` (default lnd) + an `orc-settings-general-env` for the selected impl + a second `orc-settings-general-env` for Taproot Assets.
4. Switching the select to cln swaps the lightning sample config.

## Reachable states

### 1. Bitcoin disabled

`/bitcoin/disabled`: one `orc-settings-general-env` (bitcoin sample). Observed live on fake.

### 2. Lightning disabled — lnd (default)

`/lightning/disabled`: lnd/cln select (value `lnd`), lightning env sample (lnd vars: `LIGHTNING_MACAROON`, `LIGHTNING_CERT`…), + tapd env sample. Two `orc-settings-general-env` total.

### 3. Lightning disabled — cln

Selecting cln swaps `env_config_lightning` to the cln sample (`LIGHTNING_KEY`, `LIGHTNING_CA`, `LIGHTNING_CERT`).

### 4. Redirect from the enabled route

`/bitcoin` and `/lightning` (no trailing `/disabled`) redirect to the disabled route via `enabledGuard`.

### 5. Mint disabled

Dead-branch — fake runs cdk-mintd, so mint is enabled; no shipped stack disables the mint.

## Child components

- `orc-settings-general-env`: renders an `EnvConfig` (comment + key/value lines) with copy affordances. Shared with the mint/settings surfaces.
- `mat-select` (lightning only): lnd/cln toggle driving `env_config_lightning`.

## Unhappy / edge cases

- These pages ARE the unhappy path (backend absent) — there is no further error state.
- The samples are static; a wrong sample value would ship to every no-backend operator (a bad default per AGENTS.md), which is why the env content is worth asserting.

## Template structure (at a glance)

```
/bitcoin/disabled   → orc-bitcoin-subsection-disabled → orc-settings-general-env (bitcoin sample)
/lightning/disabled → orc-lightning-subsection-disabled
                      ├─ mat-select (lnd | cln) → orc-settings-general-env (lightning sample)
                      └─ orc-settings-general-env (taproot assets sample)
```

## Interaction summary

| Gesture | Target | Result |
|---|---|---|
| Navigate | `/bitcoin` (no backend) | redirect → `/bitcoin/disabled` |
| Navigate | `/lightning` (no backend) | redirect → `/lightning/disabled` |
| Select | lnd/cln (lightning) | swaps the lightning env sample |

## Test-author handoff

### Host page + setup

- `page.goto('/bitcoin/disabled')` / `/lightning/disabled`; storageState.
- Tags: `@no-bitcoin` (bitcoin page) / `@no-lightning` (lightning page) — both match only `fake-cdk-postgres` (`config.bitcoin === false` / `config.ln === false`).

### Differential oracles

| Surface | Oracle |
|---|---|
| Reachability | `config.bitcoin` / `config.ln` — false only on fake |
| Env sample content | static (the component's hard-coded `EnvConfig`) |

### State reachability matrix

| State | lnd-nutshell-sqlite | lnd-cdk-sqlite | cln-cdk-postgres | cln-nutshell-postgres | fake-cdk-postgres |
|---|---|---|---|---|---|
| 1. Bitcoin disabled | — | — | — | — | ✓ live |
| 2. Lightning disabled (lnd) | — | — | — | — | ✓ live |
| 3. Lightning disabled (cln) | — | — | — | — | ✓ live (interaction) |
| 4. Redirect | — | — | — | — | ✓ live |
| 5. Mint disabled | — | — | — | — | — (dead-branch) |

### Per-state probes

| State | Settled signal | Primary assert |
|---|---|---|
| 1 | `orc-bitcoin-subsection-disabled` visible | one `orc-settings-general-env`; `LIGHTNING_TYPE`-free bitcoin sample |
| 2 | `orc-lightning-subsection-disabled` visible | lnd/cln select present; 2 `orc-settings-general-env`; select value `lnd` |
| 3 | env swapped | after selecting cln, the lightning env sample shows `LIGHTNING_KEY` |
| 4 | redirect settled | `/bitcoin` → URL `/bitcoin/disabled`; `/lightning` → `/lightning/disabled` |

### Reusable interaction recipes

- Material select: open via trigger, click the option in the CDK overlay (never `preview_fill`).
- Redirect assertion: `page.goto('/bitcoin')` then `expect(page).toHaveURL(/\/bitcoin\/disabled$/)`.

### Skip taxonomy

- State 5 (mint disabled): `dead-branch` — no shipped stack disables the mint.
- Env copy-button clipboard: `unit-better` — covered generically by the settings-env component tests.

## Test fidelity hooks

- No prior disabled-subsections spec.
- Planned: bitcoin disabled (1), lightning disabled lnd + cln swap (2, 3), redirects (4).
- Skipped: mint disabled (dead-branch), clipboard.

## Notes for implementers

- These pages exist ONLY on `fake-cdk-postgres` in the matrix — their coverage lives and dies with that stack. If a future matrix adds a no-mint stack, state 5 becomes live and needs a test.
- The sample `.env` content is a shipped default: keep the keys accurate (they're what operators paste), and update this spec's `LIGHTNING_KEY`/`LIGHTNING_MACAROON` anchors if the samples change.
