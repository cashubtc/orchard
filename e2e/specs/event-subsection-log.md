# `orc-event-subsection-log`

Source: [event-subsection-log.component.ts](../../src/client/modules/event/modules/event-subsection-log/components/event-subsection-log/event-subsection-log.component.ts) · [`.html`](../../src/client/modules/event/modules/event-subsection-log/components/event-subsection-log/event-subsection-log.component.html)

## Purpose

The routed body of `/event` — Orchard's audit log. It loads event logs (`event_logs` GraphQL query against Orchard's own `events` table) plus the crew user list, and renders four stacked surfaces: a filter control (date range + filter menu), a bubble-timeline chart, a Material table with expandable detail rows, and a sticky paginator. Filters persist to device settings (`SettingDeviceService.setEventLogSettings`) so the page reopens with the operator's last view. When `ai_enabled` is on it additionally wires the AI assistant (filter mutation via tool calls).

## Where it renders

- **Only usage**: lazy child route `''` of [`event-section.module.ts`](../../src/client/modules/event/modules/event-section/event-section.module.ts) at `/event`, inside `orc-event-section`'s `<router-outlet>`. No `enabledGuard` — mounts on every stack.
- The route resolves `event_log_genesis` (earliest event timestamp; `0` on resolver error) before activation — used to resolve the "genesis" date preset.
- The section wrapper `orc-event-section` renders static header "Orchard Events", the Orchard version (`config.mode.version`, e.g. `orchard/1.9.0`), and the shared more-menu (Logout) — same chrome contract as the lightning section.

## Inputs

Page component — none (route-mounted). Data flows down to children:

| Child | Input | Notes |
|---|---|---|
| `orc-event-subsection-log-control` | `date_start/date_end/sections/actor_ids/types/statuses/date_preset` from `page_settings`; `users`; `device_type` | `page_settings` = device settings merged with defaults (last 30 days, page 0, page_size 100) |
| `orc-event-subsection-log-chart` | `events` (current page rows), `date_start/date_end`, `locale`, `loading`, `page_index/page_size/count` | bubble chart buckets by hour/day/week/month based on window span |
| `orc-event-subsection-log-table` | `data_source` (`MatTableDataSource<EventLog>`), `id_user`, `loading`, `error`, `users`, `device_type` | |
| `mat-paginator` | `length=count()`, `pageSize`, `pageIndex`, `pageSizeOptions=[10,25,50,100,250,500]` | `hidePageSize` on mobile |

## Outputs & projected content

None on the page component. Children emit actions up: `dateChange`, `presetChange`, `sectionsChange`, `actorIdsChange`, `typesChange`, `statusesChange`, `resetFilter` (control); `pageChange` (chart); `(page)` (paginator); all mutate `page_settings`, persist to device settings, reset `page` to 0 (filter changes only), and call `loadData()`.

## Derived / computed signals

- `loading = computed(loading_users() || loading_events())` — table shows the neutral `table` icon while true.
- `device_type` — BreakpointObserver: XSmall → `mobile`, Small/Medium → `tablet`, else `desktop`.
- Table `displayed_columns` — mobile `[actor, event, timestamp]`, tablet `+section`, desktop `+details` (5 columns).
- Table `event_time_type` — desktop `medium`, tablet `short`, mobile `date-only`.
- Chart `has_data = events().length > 0`; `page_count = ceil(count / page_size)`.

## Happy path

1. Authenticated user opens `/event`. Genesis resolver runs; page mounts with defaults (window = start-of-day 30 days ago → end-of-day today, in the device timezone since `Settings.defaultZone` is set from device settings).
2. `event_logs` + users queries resolve; header count label shows `N Events` (hidden on mobile), table renders up to `page_size` rows, paginator shows `1 – N of M`.
3. Each row: actor cell (crew chip w/ facehash for known users; `person` icon + truncated id for unknown; `settings`/`smart_toy` icon + literal `SYSTEM`/`AGENT` for non-user actors), section chip, event icon + `entity_type`-derived label, per-detail status dots (desktop), local time.
4. Clicking a row expands the detail row (`orc-event-subsection-log-table-detail`): identifier (when `entity_id` present) + one low-card per detail showing `field`, old→new value transition (`Set to` when create-only, `Deleted` when old-only), and error code/message cards for failed details. Clicking again collapses.
5. The bubble chart renders one canvas when rows exist; chart pagination arrows page the same query the paginator does.

## Reachable states

### 1. Populated table (default)

Rows > 0 within the default window. Observed live on canary: 51 events, paginator `1 – 51 of 51`, count label `51 Events`.

### 2. Loading

`loading()` true → table area shows the `table` icon; chart canvas unmounts. Sub-second on local stacks.

### 3. Empty (filters match nothing)

`data.length === 0 && !loading && !error` → `file_save_off` icon replaces the table; chart canvas unmounts (`has_data` false); count label `0 Events`; paginator `0 of 0`. Reached live by checking a status with no events in-window (e.g. ERROR on a clean stack). Filter badge shows `Filters (1)`.

### 4. Error

`error()` true (either query fails) → `error_outline` icon. Backend-kill territory — disruptive.

### 5. Row expanded

`more_entity` set; `.more-entity-wrapper-expanded` on the detail row; `orc-event-subsection-log-table-detail` mounts. One row max — expanding another collapses the first (toggle semantics).

### 6. Filter menu open

`Filters` button (badge `Filters (N)` when N > 0) opens a mat-menu with: User chip-grid + autocomplete, Event Status checkboxes (ERROR/PARTIAL/SUCCESS), Section checkboxes (AI/BITCOIN/ECASH/LIGHTNING/MINT/SETTINGS), Event Type checkboxes (CREATE/DELETE/EXECUTE/UPDATE), plus header actions: close (icon), date-range icon (non-desktop only shows an in-menu date field), "Clear all". Checking a box immediately emits, reloads data, and persists.

### 7. Date-range picker / preset panel

The main form field has start/end date inputs (locale-formatted) and an `orc-form-daterange-scroll-picker` suffix opening a preset panel. Preset selection resolves via `resolveDateRangePreset` (uses genesis for all-time) and reloads.

### 8. Device variants

Mobile: 3 columns, no count label, paginator hides page-size select, date field moves inside the filter menu. Tablet: 4 columns, `short` times. Desktop: 5 columns.

### 9. AI assistant wiring (`ai_enabled`)

Assistant subscription + tool-call execution (date range / sections / types / statuses / actor ids / reset). Config-gated: `cln-cdk-postgres` only, exercised via `npm run e2e:test:ai`.

## Child components

### `orc-event-subsection-log-control`

- Source: [event-subsection-log-control.component.ts](../../src/client/modules/event/modules/event-subsection-log/components/event-subsection-log-control/event-subsection-log-control.component.ts) · [`.html`](../../src/client/modules/event/modules/event-subsection-log/components/event-subsection-log-control/event-subsection-log-control.component.html)
- Reactive form (`panel`): daterange group (required both ends; `mat-error` "Invalid date range" when invalid) + checkbox FormArrays synced from inputs via `effect()`s; `filter_count` badge = number of active filter dimensions.
- User filter: chip grid + autocomplete over `users` input; selecting adds a `mat-chip-row` with facehash avatar, remove via chip cancel button; emits `actorIdsChange`.
- "Clear all" (in `orc-form-filter-menu` header) emits `resetFilter` → parent clears sections/types/statuses/actor_ids (dates persist).

### `orc-event-subsection-log-chart`

- Source: [event-subsection-log-chart.component.ts](../../src/client/modules/event/modules/event-subsection-log/components/event-subsection-log-chart/event-subsection-log-chart.component.ts) · [`.html`](../../src/client/modules/event/modules/event-subsection-log/components/event-subsection-log-chart/event-subsection-log-chart.component.html)
- Bubble chart (ng2-charts) bucketing the *current page's* events by hour/day/week/month depending on window span; bubble size = bucket total, colored by success/error/partial mix.
- Flanking pagination: `first_page`/`chevron_left` disabled at page 0; `chevron_right`/`last_page` disabled at the last page (`page_index >= page_count - 1`). With ≤1 page all four are disabled.
- Canvas renders only when `displayed() && has_data() && !loading()`.

### `orc-event-subsection-log-table` / `-table-detail` / `-event-icon` / `-section-chip`

- Sources: [table](../../src/client/modules/event/modules/event-subsection-log/components/event-subsection-log-table/event-subsection-log-table.component.ts) · [detail](../../src/client/modules/event/modules/event-subsection-log/components/event-subsection-log-table-detail/event-subsection-log-table-detail.component.ts) · [event-icon](../../src/client/modules/event/modules/event-subsection-log/components/event-subsection-log-event-icon/event-subsection-log-event-icon.component.ts) · [section-chip](../../src/client/modules/event/modules/event-subsection-log/components/event-subsection-log-section-chip/event-subsection-log-section-chip.component.ts)
- Event icon by type: CREATE `add_circle`, DELETE `delete_forever`, EXECUTE `play_arrow`, UPDATE `edit` (also the fallback).
- Section chip icon: AI `spa`, SETTINGS `settings`, MINT `account_balance`, ECASH `payments`, LIGHTNING `bolt`, BITCOIN svg `bitcoin_outline`; `icon_only` below desktop.
- Detail expansion covered under state 5; value cells branch old+new / new-only ("Set to") / old-only ("Deleted"); error code/message render in an `orc-error-card`.

### `orc-event-section` (host chrome)

- Static header "Orchard Events"; `.section-implementation` = `config.mode.version`; `orc-nav-secondary-more` = same Logout menu documented in [lightning-subsection-dashboard.md](lightning-subsection-dashboard.md).

## Unhappy / edge cases

- Unknown `actor_id` (user deleted after logging events) → `person` icon + truncated id, no crew chip.
- `entity_id` null → detail expansion omits the Identifier block entirely.
- Both queries failing → single `error_outline` state; there is no retry button — recovery requires filter change or reload.
- `count()` > `page_size`: header label shows the *page* length (`data_source.data.length`), not the total — the label and the paginator total legitimately disagree on multi-page results.
- Date inputs accept locale-dependent text parsing (en-GB/es-ES/de-DE across stacks) — typed-date tests would be locale-fragile by design.

## Template structure (at a glance)

```
orc-event-subsection-log
├─ .event-log-control
│  ├─ orc-event-subsection-log-control (form: date range + Filters button → mat-menu)
│  └─ "N Events" label (device ≠ mobile)
├─ orc-event-subsection-log-chart (first/prev | canvas? | next/last)
├─ orc-event-subsection-log-table
│  └─ table.orc-feature-table (multiTemplateDataRows)
│     ├─ tr.entity-row (click → toggle) ×N
│     └─ tr.more-entity-row → orc-event-subsection-log-table-detail (when expanded)
│  └─ empty: file_save_off · error: error_outline · loading: table
└─ .data-table-sticky-footer → mat-paginator.orc-feature-paginator
```

## Interaction summary

| Gesture | Target | Result |
|---|---|---|
| Click | `tr.entity-row` | Expands/collapses detail row |
| Click | Filters button | Opens filter mat-menu |
| Check/uncheck | status/section/type `mat-checkbox` (menu) | Emits change, resets page, reloads, persists, updates badge |
| Type + select | user autocomplete (menu) | Adds chip, filters by actor id |
| Click | chip cancel button | Removes user filter |
| Click | "Clear all" (menu header) | Clears all non-date filters, reloads |
| Click | close icon (menu header) | Closes menu |
| Blur/Enter | date start/end inputs | Emits `dateChange` when valid + changed |
| Click | scroll-picker suffix | Opens preset panel; preset click resolves range + reloads |
| Click | chart first/prev/next/last | `onChartPage` → same reload as paginator |
| Click | paginator controls | `onPage` → reload with new page/page_size |

## Test-author handoff

### Host page + setup

- `page.goto('/event')`; storageState auth. Settle on `orc-event-subsection-log-control` visible + paginator range label non-empty (the range label only renders text after the first `event_logs` response).
- Tag: `@all` — the page is guard-free and every stack accumulates events from its own setup chain (settings.setup writes app settings → SETTINGS events). Note canary's settings matrix is a no-op, so canary can legitimately have rows only from operator-like spec activity; assertions must pivot on the DB oracle, never on "has events".

### Differential oracles

| Surface | Oracle |
|---|---|
| Paginator total / count | `orchard.eventCount(config, {date_start, date_end})` ([backend/orchard.ts](../helpers/backend/orchard.ts)) with the window recomputed via luxon in the stack's device timezone (`config.deviceSettings?.timezone`), mirroring `getDefaultDateStart/End` |
| Table row count | `min(eventCount, page_size)` (default 100) |
| Empty state | pick a status with `eventCount(..., {statuses: [s]}) === 0`; skip if all three statuses have rows |
| Genesis preset | `orchard.eventGenesis(config)` |
| Section header version | static `orchard/<package version>` — assert non-empty / prefix only |

### State reachability matrix

| State | lnd-nutshell-sqlite | lnd-cdk-sqlite | cln-cdk-postgres | cln-nutshell-postgres | fake-cdk-postgres |
|---|---|---|---|---|---|
| 1. Populated | ✓ live (oracle-gated) | ✓ live | ✓ live | ✓ live | ✓ live |
| 2. Loading | — transient | — transient | — transient | — transient | — transient |
| 3. Empty via status filter | ✓ live (oracle-picked) | ✓ live | ✓ live | ✓ live | ✓ live |
| 4. Error | — disruptive | — disruptive | — disruptive | — disruptive | — disruptive |
| 5. Row expanded | ✓ live (rows > 0) | ✓ live | ✓ live | ✓ live | ✓ live |
| 6. Filter menu open | ✓ live | ✓ live | ✓ live | ✓ live | ✓ live |
| 7. Preset panel | ✓ live | ✓ live | ✓ live | ✓ live | ✓ live |
| 8. Device variants | ✓ live (viewport) | ✓ | ✓ | ✓ | ✓ |
| 9. AI wiring | — | — | ✓ config-gated (`e2e:test:ai`) | — | — |

### Per-state probes

| State | Settled signal | Primary assert |
|---|---|---|
| 1. Populated | `.mat-mdc-paginator-range-label` has text | paginator total == oracle; `tr.entity-row` count == min(total, 100); count label `N Events(s)` matches page rows (desktop) |
| 2. Loading | n/a | not tested (transient) |
| 3. Empty | `mat-icon` text `file_save_off` visible | 0 `tr.entity-row`; no chart canvas; badge `Filters (1)` |
| 4. Error | n/a | not tested (disruptive) |
| 5. Expanded | `orc-event-subsection-log-table-detail` visible | exactly 1 `.more-entity-wrapper-expanded`; second click collapses |
| 6. Menu | `.cdk-overlay-container mat-checkbox` count 13 | section headers User/Event Status/Section/Event Type visible; Clear all present |
| 7. Preset panel | scroll-picker overlay visible | panel opens and closes without changing rows |
| 8. Mobile | table header cells == 3 | count label hidden; paginator page-size select hidden |
| 9. AI | n/a here | separate ai config spec |

### Reusable interaction recipes

- Material menu: real `.click()` works in Playwright; close with Escape (see [lightning-subsection-dashboard.spec.ts](lightning-subsection-dashboard.spec.ts)).
- Material checkbox in overlay: click the inner `input` (the `mat-checkbox` wrapper eats pointer events in some states).
- Viewport variants: `test.use({viewport: {width: 375, height: 812}})` in a nested describe for the mobile column set.
- Luxon window mirror: `DateTime.now().setZone(config.deviceSettings?.timezone ?? 'local').minus({days: 30}).startOf('day')` — must match `getDefaultDateStart` exactly.

### Skip taxonomy

- State 2 (loading): `unit-better` — sub-second transient.
- State 4 (error): `disruptive` — requires killing Orchard's DB mid-run.
- State 9 (AI): `stack-only` + separate AI config run (`e2e:test:ai`).
- Typed date entry: `unit-better` — locale-dependent text parsing across the stack matrix (en-GB / es-ES / de-DE) makes typed dates flaky by design; preset panel + blur handlers cover the code path.
- User autocomplete filter: covered structurally (menu contents) but chip-add flow is skipped as `unit-better` on stacks without guaranteed non-admin users; the crew spec creates/destroys users and owns that flow.
- Chart bucket/color internals: `unit-better` — canvas pixels; presence/absence asserted only.

## Test fidelity hooks

- No existing `event-subsection-log.spec.ts`; this is first coverage of `/event`.
- Planned coverage: states 1, 3, 5, 6, 7, 8 + paginator/chart-pagination disabled logic (differential on `page_count`).
- Not covered (tagged above): 2, 4, 9, typed dates, chip-add autocomplete flow, chart internals.

## Notes for implementers

- Filter mutations persist to device settings immediately — an operator's stuck filter is a support-question generator; the badge + "Clear all" are the recovery path. Tests must not rely on persisted filter state across contexts (each Playwright context re-reads the baked storageState).
- The header count label shows the current page's row count, not `count()` — renaming or "fixing" that changes an assertion here.
- `loadUsers` failure sets `error` even when events loaded fine — the table error icon can appear with a healthy `event_logs` query.
- Chart reads only the current page's events — bucket totals change when paging; that's intentional (chart == page window).
