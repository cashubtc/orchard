# `orc-mint-subsection-config`

Source: [mint-subsection-config.component.ts](../../src/client/modules/mint/modules/mint-subsection-config/components/mint-subsection-config/mint-subsection-config.component.ts) · [`.html`](../../src/client/modules/mint/modules/mint-subsection-config/components/mint-subsection-config/mint-subsection-config.component.html)

## Purpose

The routed body of `/mint/config` — the operator's control surface for the mint daemon's NUT capabilities. It renders 16 NUT panels (`nav4`…`nav29`) in a CSS-grid whose area order is operator-reorderable, each panel a chart + explanation. NUT-04 (Minting) and NUT-05 (Melting) additionally expose editable forms: an enabled toggle, quote-TTL, and per-`(method, unit)` min/max limits with method sub-forms (bolt11 / bolt12 / onchain). Edits flow through the global event stack (dirty count → PENDING → Save → SAVING → SUCCESS/ERROR), batching field changes into one bulk GraphQL mutation.

`mint_info` + `mint_quote_ttl` arrive via route resolvers. Because every write mutates the operator's live mint config, this spec is **read-only**: it asserts structure and per-stack conditional rendering, and exercises the dirty→cancel path, but never confirms a Save.

## Where it renders

- Lazy route `config` of [`mint-section.module.ts`](../../src/client/modules/mint/modules/mint-section/mint-section.module.ts), `enabledGuard`-gated (mint disabled → `/mint/disabled`).
- The lazy module wires `canDeactivate: [pendingEventGuard]` — navigating away with unsaved (PENDING) edits opens the unsaved-changes dialog (documented in [mint-subsection-keysets.md](mint-subsection-keysets.md)).
- Route title `Orchard | Mint Config`; AI assistant data `MintConfig`.

## Inputs

Route-mounted; resolver-fed `mint_info: MintInfo`, `quote_ttls: MintQuoteTtls`. Tertiary-nav ordering persists via `SettingDeviceService.getMintConfigSettings`.

## Derived / computed signals

- `device_type` — Large/XLarge → `desktop`, else `tablet`; below desktop a "Features" menu button replaces the inline tertiary nav.
- `dirty_count` (signal) → PENDING event with "N update(s)" message; zero clears the event.
- `tertiary_nav_items[navN].status` — Enabled/Disabled per NUT support (drives the nav dot). NUT-04/05 track the enabled toggle; the rest track `mint_info.nuts.nutN` presence/support.
- `method_index` — `nut4:unit:method` / `nut5:unit:method` strings gating which method sub-forms render.

## Happy path

1. Navigate to `/mint/config`. Resolvers pre-settle; 16 NUT panels render in the persisted grid order.
2. NUT-04 shows the Minting enabled toggle, mint-TTL field, and one method block per `nut4.methods` entry (bolt11 always on regtest; bolt12/onchain only where advertised). NUT-05 mirrors for Melting.
3. NUT-07…29 render `orc-mint-subsection-config-nut-supported` status panels (Supported / not), plus specialized panels (NUT-15 PMP methods, NUT-17 websocket commands, NUT-19/21/22/29 when present).
4. Editing a min/max/TTL field marks it dirty → the event stack shows "1 update"; more edits increment. Save confirmation batches a bulk mutation; cancel reverts each field to daemon truth.

## Reachable states

### 1. 16 NUT panels rendered

Schema-driven: one `orc-mint-subsection-config-nut` per NUT (4,5,7,8,9,10,11,12,14,15,17,19,20,21,22,29). Always 16 on every stack (the query selects every schema field). Observed live on canary.

### 2. NUT-04 / NUT-05 forms

Enabled toggle (`orc-mint-subsection-config-form-enabled`), quote-TTL (`-form-quote-ttl`), and method sub-forms. bolt11 present on all LN-backed stacks.

### 3. bolt12 method sub-form (stack-conditional)

Renders only when `method_index` contains `nut4:sat:bolt12` — i.e. bolt12-capable mint+LN. Present on `cln-cdk-postgres`; absent elsewhere. Observed absent on canary (`bolt12_forms: 0`).

### 4. onchain method sub-form (stack-conditional)

Renders when `method_index` contains `nut4:sat:onchain` (NUT-30 / cdk-mintd bdk). Present on `cln-cdk-postgres` (`config.onchain`); absent elsewhere.

### 5. Supported-NUT status panels

`orc-mint-subsection-config-nut-supported` renders a Supported pill per NUT that advertises support. cdk publishes nut19/29; nutshell omits them — the panels still render (schema-driven) but the status pill reflects the daemon.

### 6. Dirty → PENDING event

Editing a field increments `dirty_count`; the event stack shows "N update(s)". This is testable read-only: dirty a field, assert the PENDING chip, then cancel (revert) — no Save.

### 7. Mobile "Features" menu

Below desktop, the inline tertiary nav collapses into a `menu`-triggered mat-menu of NUT jump targets.

### 8. AI assistant

`ai_enabled` stacks wire config-editing tool calls. `e2e:test:ai`.

## Child components

- `orc-mint-subsection-config-form-enabled` (+ `-form-enabled-dialog`): the Minting/Melting on/off toggle; toggling opens a confirm dialog and emits `update` → immediate `updateMintNut04/05('disabled', …)` (a mutation — NOT exercised here).
- `orc-mint-subsection-config-form-quote-ttl` (+ `-hint`): TTL numeric field (0–604800, integer), update/cancel.
- `orc-mint-subsection-config-form-bolt11` / `-bolt12` / `-onchain`: per-method min/max forms with `-form-min`, `-form-max`, `-form-limit-hint`; sat validates as integer, non-sat as cents.
- `orc-mint-subsection-config-nut-supported`: Supported/unsupported explainer with an info popover.
- `orc-mint-subsection-config-nut15-method` / `-nut17-commands` / `-nut19` / `-nut21` / `-nut22` / `-nut29`: specialized per-NUT detail panels.
- `orc-mint-subsection-config-chart-method` / `-chart-quote-ttl`: the visual quote-volume charts backing each editable panel.

## Unhappy / edge cases

- Save with an invalid form → WARNING "Invalid config" event; nothing sent.
- Bulk mutation error → ERROR event with the resolver message; fields keep their edited (dirty) values for retry.
- `mint_info` null (resolver failure) → forms render empty; disruptive to reproduce, resolver settles on every healthy stack.
- Non-sat units format min/max to 2dp via `LocalAmountPipe`; sat stays integer — a naive digit-strip on a "1.00" cents field would misread it.

## Template structure (at a glance)

```
orc-mint-subsection-config
├─ (mobile) Features menu button
├─ .grid #nut_container  (gridTemplateAreas = persisted tertiary order)
│  ├─ nav4  → enabled toggle · quote-ttl · @if method_index has nut4:unit:{bolt11|bolt12|onchain} form
│  ├─ nav5  → (melting mirror)
│  ├─ nav7…nav29 → orc-mint-subsection-config-nut-supported / specialized panels
└─ (desktop) inline tertiary nav
```

## Interaction summary

| Gesture | Target | Result |
|---|---|---|
| Edit | min/max/TTL field | Marks dirty → PENDING "N updates" |
| Click | field cancel | Reverts field to daemon value, decrements dirty |
| Toggle | enabled switch | Opens confirm dialog → mutation (not exercised) |
| Click | tertiary nav item / Features menu item | Scrolls to that NUT panel |
| Confirm | event-stack Save | Bulk mutation (not exercised) |
| Navigate | route while PENDING | Unsaved-changes dialog |

## Test-author handoff

### Host page + setup

- `page.goto('/mint/config')`; storageState; settle on `orc-mint-subsection-config-nut` count > 0.
- Tag: `@mint` structural; `@bolt12` (cln-cdk-postgres) for state 3; `@mint` + `config.onchain` guard for state 4.

### Differential oracles

| Surface | Oracle |
|---|---|
| bolt12 method form present | `mint.getInfo(config).nuts.{nut4,nut5}.methods` contains a `bolt12` method. **Do NOT use `config.bolt12`** — that flag describes the LN backend, but the page renders from the mint's advertised methods, and fake-cdk-postgres's `fake_wallet` advertises bolt12 with no LN at all. |
| onchain method form present | `mint.getInfo(config)` methods contain `onchain` (advertised by cln-cdk-postgres's bdk backend AND fake-cdk-postgres's fake_wallet — again read the mint, not `config.onchain`). |
| bolt11 present | `config.ln !== false` (every LN stack advertises bolt11) |
| NUT panel count | constant 16 (schema-driven) |
| Minting/Melting enabled default | `mint.getInfo(config).nuts.nut4.disabled` / `nut5.disabled` |

### State reachability matrix

| State | lnd-nutshell-sqlite | lnd-cdk-sqlite | cln-cdk-postgres | cln-nutshell-postgres | fake-cdk-postgres |
|---|---|---|---|---|---|
| 1. 16 NUT panels | ✓ live | ✓ live | ✓ live | ✓ live | ✓ live |
| 2. NUT-04/05 forms | ✓ live | ✓ live | ✓ live | ✓ live | ✓ live |
| 3. bolt12 form | — | — | ✓ live | — | — |
| 4. onchain form | — | — | ✓ live | — | — |
| 5. Supported panels | ✓ live | ✓ live | ✓ live | ✓ live | ✓ live |
| 6. Dirty→PENDING | ✓ live | ✓ live | ✓ live | ✓ live | ✓ live |
| 7. Mobile Features menu | ✓ viewport | ✓ | ✓ | ✓ | ✓ |
| 8. AI | — | — | ✓ e2e:test:ai | — | — |

### Per-state probes

| State | Settled signal | Primary assert |
|---|---|---|
| 1 | `orc-mint-subsection-config-nut` count 16 | exactly 16 panels |
| 2 | `orc-mint-subsection-config-form-enabled` count 2 | Minting + Melting enabled toggles present; 2 quote-ttl forms |
| 3 | bolt12 form presence | `orc-mint-subsection-config-form-bolt12` count > 0 iff `config.bolt12` |
| 4 | onchain form presence | `orc-mint-subsection-config-form-onchain` count > 0 iff `config.onchain` |
| 5 | supported panels | `orc-mint-subsection-config-nut-supported` count > 0 |
| 6 | PENDING event chip | after dirtying a TTL field, event stack shows "1 update"; cancel clears |
| 7 | Features button | visible at mobile viewport; opens a menu |

### Reusable interaction recipes

- Field dirty without save: edit via the native-setter + `dispatchEvent('input')` recipe, assert the PENDING chip, then click the field's cancel — never confirm Save (mutation).
- Stack-conditional presence: `expect(locator).toHaveCount(config.bolt12 ? <n> : 0)`.
- Mobile viewport: nested `test.use({viewport})` describe as in the event-log and keysets specs.

### Skip taxonomy

- Enabled-toggle confirm, TTL/min/max Save, bulk mutation: `disruptive` — persists to the operator's mint config; every mint-info-reading spec would drift.
- Chart pixels: `unit-better` (canvas).
- NUT-15/17/19/21/22/29 detail internals: covered structurally (panel presence); their values are daemon-advertised and asserted by the mint-general-config card spec.
- State 8 (AI): `stack-only` via `e2e:test:ai`.

## Test fidelity hooks

- No prior `mint-subsection-config.spec.ts` (the card-level `mint-general-config.spec.ts` covers the read-only `/mint` chip card).
- Planned: states 1, 2, 3, 4, 5, 6, 7.
- Skipped: all Save/mutation paths (disruptive), chart pixels, AI.

## Notes for implementers

- Save batches every dirty field into one dynamically-built GraphQL mutation (`onConfirmedEvent`) — a fragile string-built query; changes to field names or types there must stay in sync with the server's `mint_nut04_update` / `mint_nut05_update` signatures.
- `canDeactivate` blocks nav only on PENDING (not WARNING) — same rule as the keysets page.
- The grid area order is operator state (device settings); a test that reorders it persists that change — restore or use a fresh context.
- bolt12/onchain sub-forms are the only per-stack-conditional UI on this page; they are the cheapest signal that a stack's mint advertises those methods.
