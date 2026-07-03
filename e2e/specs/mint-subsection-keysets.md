# `orc-mint-subsection-keysets`

Source: [mint-subsection-keysets.component.ts](../../src/client/modules/mint/modules/mint-subsection-keysets/components/mint-subsection-keysets/mint-subsection-keysets.component.ts) · [`.html`](../../src/client/modules/mint/modules/mint-subsection-keysets/components/mint-subsection-keysets/mint-subsection-keysets.component.html)

## Purpose

The routed body of `/mint/keysets` — keyset inventory, per-keyset analytics, and the **keyset rotation** flow. Keysets and counts arrive via route resolvers (`mint_keysets`, `mint_keyset_counts`); analytics load post-mount (`mint_analytics_keysets` windowed + pre-range). The page owns a collapsible rotation form (gated behind the global event stack's PENDING/confirm cycle), a stacked-area chart, a filter control, and a sortable table with expandable rows.

## Where it renders

- Lazy child route `keysets` of [`mint-section.module.ts:176-192`](../../src/client/modules/mint/modules/mint-section/mint-section.module.ts#L176), gated by `enabledGuard` (mint disabled → `/mint/disabled`).
- The lazy module's own route wires `canDeactivate: [pendingEventGuard]` ([mint-subsection-keysets.module.ts:53](../../src/client/modules/mint/modules/mint-subsection-keysets/mint-subsection-keysets.module.ts#L53)) — leaving mid-rotation opens the unsaved-changes dialog.
- Route title `Orchard | Mint Keysets`; AI assistant route data (`MintKeysets`).

## Inputs

Route-mounted; none. Resolver-fed properties: `mint_keysets: MintKeyset[]`, `keysets_counts: MintKeysetCount[]`. Page settings (units/status/date filters) persist via `SettingDeviceService.getMintKeysetsSettings` — defaults: units `[]`, status `[]`, window = mint genesis (min `valid_from`) → end of today.

## Outputs & projected content

None; children communicate up via outputs (`dateChange`, `presetChange`, `unitsChange`, `statusChange`, `rotateKeyset`, `highlightChange`, `moreRequest`, `updateUnit`, `close`).

## Derived / computed signals

- `device_type` — BreakpointObserver (same mapping as the event log page).
- Table `displayed_columns` — mobile `[keyset]`; tablet `[keyset, input_fee_ppk, valid_from, balance]`; desktop `[keyset, id, input_fee_ppk, valid_from, balance, fees_paid, proof_count, promise_count, actions]`.
- `interval` — Day ≤90d window, Week ≤365d, else Month.
- Table rows = keysets filtered by `date_end >= valid_from`, status filter, units filter, sorted by `derivation_path_index` desc, joined with analytics + counts.
- Form defaults: unit `sat` (or most common), `input_fee_ppk` from the unit's active keyset (fallback 1000), amounts `2^0..2^31`, `keyset_v2` = `mint_type !== 'nutshell'`; `default_amounts` control disabled on nutshell.

## Happy path

1. Navigate to `/mint/keysets`. Resolvers settle before activation; table renders one row per keyset (clean stacks: one active sat keyset).
2. Analytics load; chart canvas mounts; balance/fees/proofs/promises columns populate.
3. Filters button opens the Units (one checkbox per provisioned unit) + Status (Active/Inactive) menu.
4. "Keyset Rotation" FAB expands the collapsible form (Unit select, Input Fee PPK, V1/V2 format cards, Advanced amounts, rotation preview) and registers a PENDING "Save" event in the global event stack.
5. Confirming the event stack's Save runs `rotateMintKeysets`; success collapses the form, reloads keysets/analytics — the old keyset flips inactive, a new one appears.

## Reachable states

### 1. Table populated (default filters)

One row per DB keyset. Desktop: 9 columns. Sorted newest derivation index first.

### 2. Rotation form open / closed

FAB toggles `.orc-animation-collapsible.animation-open`. Open state scrolls the form into view, fetches keyset balance + median note stats, registers the PENDING Save event. Close (form's `close` button, or FAB again) clears the event.

### 3. V2 format availability (mint-impl differential)

V2 card `[disabled]="mint_type() === 'nutshell'"`; description text `Unsupported in Nutshell` vs `33 byte keyset IDs` ([mint-subsection-keysets-form.component.ts:37-38](../../src/client/modules/mint/modules/mint-subsection-keysets/components/mint-subsection-keysets-form/mint-subsection-keysets-form.component.ts#L37)). Default selection: V1 on nutshell, V2 on cdk.

### 4. Filter menu open + status/units filtering

Units checkboxes mirror provisioned units; Status = Active / Inactive. Checking Active filters rows to active keysets. Multi-unit stacks (`cln-nutshell-postgres` sat+usd+eur, `fake-cdk-postgres` sat+usd) show one Units checkbox per unit.

### 5. Unsaved-changes dialog (pendingEventGuard)

With rotation open (PENDING event), any router navigation opens `orc-event-general-unsaved-dialog`: warning icon + "You have unsaved changes…" + `Stay on page` / `Leave page`. Stay keeps the URL and the open form; Leave clears the event and navigates.

### 6. Row expansion (`more_entity`)

Row click toggles an expansion area (`moreRequest` fires oracle conversion on `@oracle` stacks); hover highlights the corresponding chart series.

### 7. Loading / empty variants

`loading_dynamic_data` gates chart/table skeletons; sub-second locally. Rows can only be empty via filters (daemons auto-provision sat) — e.g. Inactive-only on a never-rotated stack.

### 8. Device variants

Mobile: single `keyset` column, icon-only FAB. Tablet: 4 columns, icon-only FAB. Desktop: 9 columns, extended FAB labelled "Keyset Rotation".

### 9. AI assistant / rotation assistant

`ai_enabled` stacks wire assistant + tool calls (rotation context when the form is open). `e2e:test:ai` territory.

## Child components

### `orc-mint-subsection-keysets-control`

Date-range field + presets (`orc-form-daterange-scroll-picker`, genesis-aware) and the Filters mat-menu (Units / Status checkbox sections inside `orc-form-filter-menu` with Clear all / close). Same interaction contract as the event log control.

### `orc-mint-subsection-keysets-form` (+ `orc-mint-subsection-keysets-rotation-preview`)

- Source: [form .ts](../../src/client/modules/mint/modules/mint-subsection-keysets/components/mint-subsection-keysets-form/mint-subsection-keysets-form.component.ts) · [`.html`](../../src/client/modules/mint/modules/mint-subsection-keysets/components/mint-subsection-keysets-form/mint-subsection-keysets-form.component.html)
- Inputs: `mint_type`, `form_group`, `unit_options`, `keyset_out` (the keyset being rotated out), `keyset_out_balance`, `median_notes`.
- Surfaces: Unit mat-select; Input Fee PPK numeric input (0–100000, required); V1/V2 selectable cards (state 3); "Advanced" toggle exposing amounts editing (disabled while `default_amounts` is on; `default_amounts` control itself disabled on nutshell); a rotation preview (old keyset → new keyset visual); close button.
- Outputs: `updateUnit` (refetches balance for the newly selected unit), `close`.
- Submission is NOT in the form — it goes through the global event stack's Save confirmation (`onConfirmedEvent` → `rotateMintKeysets(unit, input_fee_ppk, amounts, keyset_v2)`), with WARNING "Invalid keyset" on invalid form, ERROR with the resolver message on RPC failure, SUCCESS "Rotation complete!" then data reload.

### `orc-mint-subsection-keysets-chart`

Stacked area of per-keyset balances over the window; series highlight follows table hover/expansion (`highlighted_keyset_id`). Canvas mounts when analytics are loaded.

### `orc-mint-subsection-keysets-table`

Sortable (MatSort) filtered rows; expansion row via `toggleMore`; `actions` column (desktop) carries a per-row rotate trigger emitting `rotateKeyset(unit)` → opens the form pre-set to that unit.

### `orc-event-general-unsaved-dialog`

- Source: [event-general-unsaved-dialog.component.html](../../src/client/modules/event/modules/event-general/components/event-general-unsaved-dialog/event-general-unsaved-dialog.component.html), opened by [pending-event.guard.ts](../../src/client/modules/event/guards/pending-event.guard.ts).
- No data payload. Buttons: `Stay on page` (closes, navigation cancelled), `Leave page` (closes with `true`, clears the active event after 100 ms, navigation proceeds).

## Unhappy / edge cases

- Rotation RPC failure → ERROR event in the stack with the resolver's message; form stays open, keysets unchanged.
- Invalid form on Save → WARNING "Invalid keyset" event; nothing sent.
- `mint_keysets` resolver returning `[]` — `getDefaultUnit` reads `this.mint_keysets[0].unit` and would throw; unreachable on real daemons (auto-provisioned sat) — dead-branch.
- `input_fee_ppk` > 100000 or negative → form invalid (Validators), Save warns.
- Window ending before a keyset's `valid_from` hides that keyset from the table (date filter is an under-appreciated row filter).

## Template structure (at a glance)

```
orc-mint-subsection-keysets
├─ .mint-keyset-control → orc-...-control (date + Filters menu) · FAB "Keyset Rotation"
├─ .orc-animation-collapsible[.animation-open] → orc-...-form (Unit, PPK, V1/V2, Advanced, preview, close)
├─ orc-mint-subsection-keysets-chart (canvas)
└─ orc-mint-subsection-keysets-table (sortable, expandable, actions)
```

## Interaction summary

| Gesture | Target | Result |
|---|---|---|
| Click | FAB (`switch_access_shortcut_add`) | Toggles rotation form + PENDING Save event |
| Click | form close button | Collapses form, clears event |
| Select | Unit mat-select (form) | `updateUnit` → balance refetch, preview updates |
| Click | V1 / V2 cards (form) | Sets `keyset_v2` (V2 disabled on nutshell) |
| Click | Filters button | Opens Units/Status menu |
| Check | Active / Inactive / unit checkboxes | Filters table rows, persists |
| Click | table row | Expands detail, highlights chart series |
| Click | row rotate action (desktop) | Opens form pre-set to that unit |
| Navigate | any route while PENDING | Unsaved dialog: Stay / Leave |
| Confirm | event-stack Save | Runs rotation (SUCCESS/ERROR/WARNING) |

## Test-author handoff

### Host page + setup

- `page.goto('/mint/keysets')`; storageState; settle on table rows visible (resolvers pre-settle so rows render with the route).
- Tag: `@mint` for structure; `@nutshell` / `@cdk` for the V2 differential; the rotation *save* is excluded everywhere (disruptive).

### Differential oracles

| Surface | Oracle |
|---|---|
| Row count (no filters) | `mint.keysets(config).length` ([backend/mint.ts](../helpers/backend/mint.ts)) |
| Active-filtered rows | `mint.keysets(config).filter(k => k.active).length` |
| Fee rate cell | `mint.keysets(config)[...].input_fee_ppk` |
| Units checkboxes | `mintUnitsFor(config)` ([helpers/config.ts](../helpers/config.ts)) |
| V2 availability | `config.mint` |
| Balance / proofs / promises columns | analytics archive — reuse `mint.keysetCountsOracle` if asserted; skipped here (covered by mint-general-keysets card spec) |

### State reachability matrix

| State | lnd-nutshell-sqlite | lnd-cdk-sqlite | cln-cdk-postgres | cln-nutshell-postgres | fake-cdk-postgres |
|---|---|---|---|---|---|
| 1. Table populated | ✓ live | ✓ live | ✓ live | ✓ live | ✓ live |
| 2. Rotation open/close | ✓ live | ✓ live | ✓ live | ✓ live | ✓ live |
| 3a. V2 disabled (nutshell) | ✓ live | — | — | ✓ live | — |
| 3b. V2 default (cdk) | — | ✓ live | ✓ live | — | ✓ live |
| 4. Filter menu + filtering | ✓ live | ✓ live | ✓ live | ✓ live | ✓ live (multi-unit) |
| 5. Unsaved dialog | ✓ live | ✓ live | ✓ live | ✓ live | ✓ live |
| 6. Row expansion | ✓ live | ✓ live | ✓ live | ✓ live | ✓ live |
| 7. Loading/empty | — transient / filter-dependent | — | — | — | — |
| 8. Device variants | ✓ viewport | ✓ | ✓ | ✓ | ✓ |
| 9. AI | — | — | ✓ `e2e:test:ai` | — | — |

### Per-state probes

| State | Settled signal | Primary assert |
|---|---|---|
| 1 | `orc-mint-subsection-keysets-table tr.entity-row` count > 0 | row count == oracle; desktop `th` count 9 |
| 2 | `.orc-animation-collapsible.animation-open` present | form visible after FAB; gone after close |
| 3 | form open | V2 card disabled + `Unsupported in Nutshell` (nutshell) / enabled + selected (cdk) |
| 4 | `.cdk-overlay-container orc-form-filter-menu` visible | checkbox set == units ∪ {Active, Inactive}; Active-check filters rows to oracle count |
| 5 | `orc-event-general-unsaved-dialog` visible | Stay keeps URL; dialog closes |
| 6 | expansion wrapper expanded | one expanded row after click |
| 8 | viewport-driven | mobile: 1 `th` |

### Reusable interaction recipes

- Filter menu + checkbox click via inner `input` — same as [event-subsection-log.spec.ts](event-subsection-log.spec.ts).
- FAB click: plain `.click()` — Playwright real events don't suffer the preview MCP's FAB issue.
- Unsaved dialog: trigger via secondary-nav item click (router navigation), not `page.goto` (a hard load fires `beforeunload` instead of the guard).

### Skip taxonomy

- Rotation save/confirm cycle: `disruptive` — appends a keyset to the daemon DB; every sibling spec that counts keysets or assumes one-active-per-unit breaks. A dedicated serial teardown-aware spec could own this later.
- Event-stack Save chip rendering: covered by the event-general components, not this page; interplay asserted only via the unsaved dialog.
- Chart series/highlight pixels: `unit-better` (canvas).
- Analytics column values: covered differentially by the mint-general-keysets card spec (`@analytics`); duplicating here adds flake surface without new information.
- State 9 (AI): `stack-only` via `e2e:test:ai`.

## Test fidelity hooks

- No prior `mint-subsection-keysets.spec.ts` (the card-level `mint-general-keysets.spec.ts` covers the `/mint` dashboard card, not this page).
- Planned: states 1, 2, 3a/3b, 4, 5, 6, 8.
- Skipped (tagged above): rotation save, chart pixels, analytics columns, AI.

## Notes for implementers

- The page is pre-signals legacy (plain props + `cdr.detectChanges`) except `device_type` / `highlighted_keyset_id` / `bitcoin_oracle_data`.
- The rotation flow's state machine lives in the EVENT service, not the form: PENDING → confirm → SAVING → SUCCESS/ERROR/WARNING; `getEventSubscription` re-registers PENDING 1s after a null event while the form is open — tests that clear events must close the form first or the chip reappears.
- `canDeactivate` reads `active_event?.type !== 'PENDING'` — a WARNING (invalid form) event does NOT block navigation; only PENDING does.
