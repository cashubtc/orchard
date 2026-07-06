# `orc-bitcoin-subsection-disabled` / `orc-lightning-subsection-disabled`

Source:
- Bitcoin: [bitcoin-subsection-disabled.component.ts](../../src/client/modules/bitcoin/modules/bitcoin-subsection-disabled/components/bitcoin-subsection-disabled/bitcoin-subsection-disabled.component.ts) · [`.html`](../../src/client/modules/bitcoin/modules/bitcoin-subsection-disabled/components/bitcoin-subsection-disabled/bitcoin-subsection-disabled.component.html)
- Lightning: [lightning-subsection-disabled.component.ts](../../src/client/modules/lightning/modules/lightning-subsection-disabled/components/lightning-subsection-disabled/lightning-subsection-disabled.component.ts) · [`.html`](../../src/client/modules/lightning/modules/lightning-subsection-disabled/components/lightning-subsection-disabled/lightning-subsection-disabled.component.html)

## Purpose

The "backend absent" pages. When Orchard boots without `BITCOIN_TYPE` / `LIGHTNING_TYPE`, `enabledGuard` redirects `/bitcoin` → `/bitcoin/disabled` and `/lightning` → `/lightning/disabled`. Each renders a single **docs-link card** (`orc-public-docs-link-card`) that points the operator at the official configuration docs on docs.orchard.space — the copy-pasteable env samples that used to live inline moved to the docs site. Clicking the card's button does NOT navigate directly: it opens the `orc-public-exit-warning` dialog showing the exact external URL, and only Proceed leaves the app.

## Where it renders

- Only on stacks booted without the backend. On the shipped matrix that is `fake-cdk-postgres` (no `BITCOIN_TYPE`, no `LIGHTNING_TYPE`). Every other stack wires both, so `enabledGuard` never redirects and these pages are unreachable.
- Mint is enabled on `fake-cdk-postgres` (it runs cdk-mintd), so `orc-mint-subsection-disabled` is NOT reachable on the current matrix — dead-branch here (it renders the same docs-card shape with a `#mint`-anchored link).

## Inputs

Neither page takes runtime inputs; each holds a hard-coded `docs_link` constant:
- bitcoin: `https://docs.orchard.space/install/configuration/#bitcoin`
- lightning: `https://docs.orchard.space/install/configuration/#lightning`

## Happy path (fake stack)

1. Operator opens `/bitcoin` on a no-bitcoin stack. `enabledGuard` redirects to `/bitcoin/disabled`.
2. `orc-bitcoin-subsection-disabled` renders one `orc-public-docs-link-card` (icon + "Bitcoin Configuration" title + body copy + "Bitcoin configuration docs" button).
3. Clicking the button opens `orc-public-exit-warning` with the leave-the-app warning and the raw docs URL; Cancel closes it in-app, Proceed opens the external site.
4. `/lightning` → `/lightning/disabled` renders the same shape with the Lightning card and `#lightning`-anchored link.

## Reachable states

### 1. Bitcoin disabled

`/bitcoin/disabled`: one `orc-public-docs-link-card`, title "Bitcoin Configuration". Observed live on fake.

### 2. Lightning disabled

`/lightning/disabled`: one `orc-public-docs-link-card`, title "Lightning Configuration". Observed live on fake.

### 3. Exit-warning dialog

Clicking either card's docs button opens `orc-public-exit-warning`: warning copy ("You are about to leave the app…"), the raw target URL, Cancel / Proceed buttons. Cancel returns to the page; Proceed opens the external docs.

### 4. Redirect from the enabled route

`/bitcoin` and `/lightning` (no trailing `/disabled`) redirect to the disabled route via `enabledGuard`.

### 5. Mint disabled

Dead-branch — fake runs cdk-mintd, so mint is enabled; no shipped stack disables the mint.

## Child components

- `orc-public-docs-link-card`: outlined mat-card with projected icon/title/body and a `docs-link-button`; `onDocsLink()` opens the exit-warning dialog with `{data: {link: docs_link}}`.
- `orc-public-exit-warning` (dialog): renders the warning + `data.link`; Cancel is `mat-dialog-close`, Proceed calls `onProceed()` (external `window.open`).

## Unhappy / edge cases

- These pages ARE the unhappy path (backend absent) — there is no further error state.
- The `docs_link` constants are shipped defaults: a wrong or dead URL ships to every no-backend operator (a bad default per AGENTS.md), which is why the exact URL is worth asserting.

## Template structure (at a glance)

```
/bitcoin/disabled   → orc-bitcoin-subsection-disabled   → orc-public-docs-link-card ("Bitcoin Configuration")
/lightning/disabled → orc-lightning-subsection-disabled → orc-public-docs-link-card ("Lightning Configuration")
   card button → orc-public-exit-warning dialog (Cancel | Proceed → external docs)
```

## Interaction summary

| Gesture | Target | Result |
|---|---|---|
| Navigate | `/bitcoin` (no backend) | redirect → `/bitcoin/disabled` |
| Navigate | `/lightning` (no backend) | redirect → `/lightning/disabled` |
| Click | "… configuration docs" button | opens `orc-public-exit-warning` with the docs URL |
| Click | dialog Cancel | closes dialog, stays in-app |
| Click | dialog Proceed | opens the external docs site (not e2e-exercised) |

## Test-author handoff

### Host page + setup

- `page.goto('/bitcoin')` / `/lightning` (assert the redirect); storageState.
- Tags: `@no-bitcoin` (bitcoin page) / `@no-lightning` (lightning page) — both match only `fake-cdk-postgres` (`config.bitcoin === false` / `config.ln === false`).

### Differential oracles

| Surface | Oracle |
|---|---|
| Reachability | `config.bitcoin` / `config.ln` — false only on fake |
| Docs URL | static (the component's hard-coded `docs_link`) — assert verbatim |

### State reachability matrix

| State | lnd-nutshell-sqlite | lnd-cdk-sqlite | cln-cdk-postgres | cln-nutshell-postgres | fake-cdk-postgres |
|---|---|---|---|---|---|
| 1. Bitcoin disabled | — | — | — | — | ✓ live |
| 2. Lightning disabled | — | — | — | — | ✓ live |
| 3. Exit-warning dialog | — | — | — | — | ✓ live (interaction) |
| 4. Redirect | — | — | — | — | ✓ live |
| 5. Mint disabled | — | — | — | — | — (dead-branch) |

### Per-state probes

| State | Settled signal | Primary assert |
|---|---|---|
| 1 | `orc-bitcoin-subsection-disabled` visible | one `orc-public-docs-link-card`; text "Bitcoin Configuration" |
| 2 | `orc-lightning-subsection-disabled` visible | one `orc-public-docs-link-card`; text "Lightning Configuration" |
| 3 | `orc-public-exit-warning` visible | contains the exact `docs_link` URL; Cancel closes it |
| 4 | redirect settled | `/bitcoin` → URL `/bitcoin/disabled`; `/lightning` → `/lightning/disabled` |

### Reusable interaction recipes

- Redirect assertion: `page.goto('/bitcoin')` then `expect(page).toHaveURL(/\/bitcoin\/disabled$/)`.
- Dialog: `getByRole('button', {name: '<link_title>'})` → assert `orc-public-exit-warning` content → `getByRole('button', {name: 'Cancel'})`.

### Skip taxonomy

- State 5 (mint disabled): `dead-branch` — no shipped stack disables the mint.
- Dialog Proceed: `unit-better` — opens an external site; the dialog's Karma spec owns the wiring.

## Test fidelity hooks

- Covered by `disabled-subsections.spec.ts`: states 1–4 (both cards, dialog round-trip with Cancel, both redirects).
- Skipped: mint disabled (dead-branch), Proceed (unit-better).

## Notes for implementers

- These pages exist ONLY on `fake-cdk-postgres` in the matrix — their coverage lives and dies with that stack. If a future matrix adds a no-mint stack, state 5 becomes live and needs a test.
- The `docs_link` URLs are shipped defaults and are asserted VERBATIM in the spec — moving/renaming the docs anchors is a breaking change for every deployed instance's disabled pages, and the spec will flag it.
