# `orc-mint-subsection-dashboard`

Source: [mint-subsection-dashboard.component.ts](../../src/client/modules/mint/modules/mint-subsection-dashboard/components/mint-subsection-dashboard/mint-subsection-dashboard.component.ts) · [`.html`](../../src/client/modules/mint/modules/mint-subsection-dashboard/components/mint-subsection-dashboard/mint-subsection-dashboard.component.html)

## Purpose

The mint dashboard page at `/mint`. This spec covers the **Nutalytics** section of that page — a date/interval/units control plus a 6-chart grid driven by it. The Nutalytics surface is owned directly by the host (no `orc-nutalytics-*` wrapper); the host also renders a Mint summary card and an `orc-mint-general-balance-sheet` summary card above Nutalytics, both of which are documented in their own specs and out of scope here. Within scope:

- a control bar (`orc-mint-subsection-dashboard-control`) that owns the date range, interval, units filter, and (when Bitcoin oracle is on) an "Convert prices" toggle
- six chart cards in a CSS-grid whose order is reorderable via the page's tertiary nav: **Balance Sheet**, **Mints**, **Melts**, **Swaps**, **Fee Revenue**, **Ecash Counts**
- a per-chart "Totals / Volume" type toggle (mat-menu) that flips the chart between cumulative line/area and bucketed bar
- an archiving progress strip ("Archiving… ▰▰▱▱▱") under the Nutalytics title while either the mint or lightning analytics backfill is running
- the host orchestrates the data: it fetches per-bucket analytics for the selected window AND a separate "pre" window from `epoch_start` up to `date_start − 1` so cumulative charts can carry a baseline forward

The host is `OnPush`. Every control gesture mutates `page_settings()` (a `WritableSignal<NonNullableMintDashboardSettings>`), persists it to `SettingDeviceService.setMintDashboardSettings`, and (for date/interval/units changes only) calls `reloadDynamicData()` which clears the analytics cache and re-runs `loadMintAnalytics()` + `loadLightningAnalytics()` in parallel. Oracle and chart-type changes mutate `page_settings()` only — the chart components recompute locally on `ngOnChanges`.

## Where it renders

- **Only usage**: route `/mint` (the lazy `MintSubsectionDashboardComponent` is wired up at [mint-subsection-dashboard.module.ts:41](../../src/client/modules/mint/modules/mint-subsection-dashboard/mint-subsection-dashboard.module.ts#L41); top-level routing in [routing.module.ts](../../src/client/modules/routing/routing.module.ts)).
- The route resolver pre-loads `mint_info`, `mint_balances`, `mint_keysets`, `mint_keyset_counts`, `mint_database_info` into `route.snapshot.data`; the constructor reads them synchronously, which is why `mint_genesis_time` and the initial `page_settings()` are available before `ngOnInit`.
- Lightning balance + analytics are only fetched when `config.lightning.enabled === true`.
- Bitcoin oracle price + price-map are only fetched when the `bitcoin_oracle` app setting is true.

## Inputs

This component takes no `@Input()`s — it is a routed page. The state surface comes from route data + services + saved per-device settings:

| Source | Type | Where it ends up | Notes |
|---|---|---|---|
| `route.data.mint_info` | `MintInfo` | `mint_info` | NUT-06 info from the mint daemon. Drives the connection-test sidecar. |
| `route.data.mint_balances` | `MintBalance[]` | `mint_balances` | Live keyset balances. Threaded into the Balance Sheet *summary* card and into the Balance Sheet chart's `correctLastPointWithLiveBalance` so the rightmost cumulative point matches the live total even if the analytics archive is up to an hour stale. |
| `route.data.mint_keysets` | `MintKeyset[]` | `mint_keysets` | Drives unit list in the filter menu, the Mint Genesis annotation timestamp (`min(valid_from)`), and the `mint_fee_revenue` decision (any `keyset.fees_paid > 0`). |
| `SettingDeviceService.getMintDashboardSettings()` | `MintDashboardSettings` | `page_settings()` | Persisted per-device (localStorage); `getPageSettings()` fills in defaults: 3-month window from today, `interval=day`, `units=[]`, `type.balance_sheet=totals`, `type.{mints,melts,swaps,fee_revenue}=volume`, `type.ecash=totals`, `summary_nav=[summary1,summary2]`, `chart_nav=[nav1..nav6]`, `oracle_used=false` (forced false if oracle disabled). |
| `mintAnalyticsBalances` query × 7 + `lightningAnalyticsLocalBalance` × 1 | `MintAnalytic[]` / `LightningAnalytic[]` | per-chart inputs | One pair per chart: a "current window" call with the user's `interval`, plus a "pre" call from `config.constants.epoch_start` to `startOfHour(date_start) − 1` with `interval=custom`. The pre-data is what `prependData()` carries into cumulative-mode charts so the leftmost point is non-zero. |
| `mintAnalyticsBackfillStatus` query | `OrchardAnalyticsBackfillStatus` | `mint_analytics_backfill_status()` (signal) | Drives the `is_archiving` computed and the unified progress bar. |
| `lightningAnalyticsBackfillStatus` query | `OrchardAnalyticsBackfillStatus` | `lightning_analytics_backfill_status()` (signal) | Same. |
| `loadBitcoinOraclePrice` + `loadBitcoinOraclePriceMap(date_start, date_end)` | `BitcoinOraclePrice` / `Map<number, number>` | `bitcoin_oracle_price()`, `bitcoin_oracle_price_map()` | Only loaded when `bitcoin_oracle_enabled`. The map is keyed by hour timestamps and feeds `convertChartDataWithOracle()` inside each chart when the user has "Convert prices" toggled on. |
| `loadLightningBalance()` | `LightningBalance` | `lightning_balance` | Only loaded when `lightning_enabled`. Threaded into the Balance Sheet chart's asset dataset so the rightmost asset point matches live LN local balance. |
| `loadMintWatchdogStatus()` | `MintWatchdogStatus` | `mint_watchdog_status` | Only fetched when `mint_type === 'nutshell'`. Drives the "Nutshells watchdog required" overlay over the Fee Revenue chart. |

## Outputs & projected content

- The host has no `@Output()`s and projects no `<ng-content>`.
- It does emit `(navigate)` from the **summary** Balance Sheet card via `onNavigate('lightning')`, but that is the summary surface, not the Nutalytics surface in scope here.

## Derived / computed signals

Host computeds that gate Nutalytics rendering:

- `summary_nav` / `chart_nav` — `() => page_settings().summary_nav` / `…chart_nav`. Drives `gridTemplateAreas` rebuild in `updateGridNav()`. The chart cards each declare `grid-area: nav1..nav6` ([mint-subsection-dashboard.component.scss:96-112](../../src/client/modules/mint/modules/mint-subsection-dashboard/components/mint-subsection-dashboard/mint-subsection-dashboard.component.scss#L96)) so reordering `chart_nav` reflows the grid without re-mounting the charts.
- `type_balance_sheet` / `type_mints` / `type_melts` / `type_swaps` / `type_fee_revenue` / `type_ecash` — `() => page_settings().type[X] ?? <default>`. Each defaults differ: balance sheet & ecash → `Totals`; mints, melts, swaps, fee revenue → `Volume`. This is what the per-chart toggle button shows in Title-case.
- `loading_analytics` — `() => loading_mint() || loading_bitcoin()`. Threaded into every chart's `[loading]` input so all six show their spinner overlay together.
- `is_archiving` — `() => mint.is_running || lightning.is_running`. Toggles the title's "Archiving…" sublabel and the progress bar.
- `archiving_progress` — `computeArchivingProgress()` ([mint-subsection-dashboard.component.ts:240-264](../../src/client/modules/mint/modules/mint-subsection-dashboard/components/mint-subsection-dashboard/mint-subsection-dashboard.component.ts#L240)). Sums completed streams + a fraction for the in-flight stream's `(last_processed_at - first_processed_at) / (now - first_processed_at)`. Capped at 99 so the bar only reads 100 when `is_archiving` itself flips false.

Per-chart computeds are documented in the **Child components** section.

## Happy path

1. The router resolver loads `mint_info`, `mint_balances`, `mint_keysets`, `mint_keyset_counts`. Constructor reads them, computes `mint_genesis_time = min(keyset.valid_from)`, and initialises `page_settings()` from the saved device settings (or defaults). `loading_static_data = true`.
2. `ngOnInit` kicks off `initAnalytics()`. It computes the locale, runs `updateGridNav('summary')` + `updateGridNav('charts')` to set `gridTemplateAreas`, flips `loading_static_data = false` (which mounts the control component — see `@if (page_settings())` in the template).
3. `loadMintAnalytics()` fires 14 GraphQL calls in one `forkJoin`: 7 metrics (balances, mints, melts, swaps, fees, proofs, promises) × 2 windows (current + pre). The "current" call uses the user's `interval`; the "pre" call uses `epoch_start → date_start − 1` with `interval = custom` (one bucket covering all prior history).
4. In parallel `loadLightningAnalytics()` does the same for `lightningAnalyticsLocalBalance`. Both also pull a `…BackfillStatus`.
5. When everything settles, `loading_mint = false` (and `loading_bitcoin = false` once the oracle map resolves). All six chart `OnChanges` fire with `loading: false → true`, each chart's `init()` runs once, builds chart data, and renders.
6. User changes Interval to Hour → control emits `(intervalChange)` → host updates `page_settings.interval`, persists settings, calls `reloadDynamicData()` which clears the cache, sets `loading_mint = true` (spinner overlays appear on every chart), re-runs both analytics loads, then `loading_mint = false` and all six charts repaint with new buckets.

## Reachable states

### 1. Default render (post-load)

- Title "Nutalytics" with no archiving sublabel.
- Control bar shows `Date range` (3-month default), `Interval = Day`, `Filters` button (no count badge).
- All 6 charts render in `nav1..nav6` order: Balance Sheet (Totals), Mints (Volume), Melts (Volume), Swaps (Volume), Fee Revenue (Volume), Ecash Counts (Totals).
- Tertiary nav rail on the right shows **Summary** [Mint, Balance Sheet] then **Charts** [Balance Sheet, Mints, Melts, Swaps, Fee Revenue, Ecash Counts].

### 2. Archiving in progress

`mint_analytics_backfill_status().is_running === true` OR `lightning_analytics_backfill_status().is_running === true`.

- Title sublabel: "Archiving…" in `orc-status-warning-color` (amber).
- A 0.5rem `orc-progress-bar` with `variant="progress-warning"` mounts under the title with `[value]="archiving_progress()"` (capped 0–99).
- Title block only renders on desktop (`@if (device_type() === 'desktop')`); on tablet/mobile the title is hidden entirely so neither label nor progress bar appears.

### 3. Loading (initial fetch)

`loading_mint()` is true OR `loading_bitcoin()` is true → `loading_analytics()` true → every chart's `[loading]="loading_analytics()"` is true and each chart shows a `mat-progress-spinner` (diameter 30) overlaid on the canvas. The control bar still renders fully and is interactive (toggling Interval / Filters during loading is allowed; `reloadDynamicData()` re-fires from a clean cache key). Existing chart geometry remains visible behind the spinner — the chart isn't destroyed.

### 4. Reordering charts via tertiary nav

User drags an item in the right-rail "Charts" `orc-nav-tertiary` → `(orderChange)` fires `onTertiaryNavChange(['nav4','nav1',…], 'charts')` → `page_settings.chart_nav` updates → settings persisted → `updateGridNav('charts')` rewrites `chart_container.style.gridTemplateAreas`. Charts reflow without unmount.

### 5. Scroll-into-view via tertiary nav click

User clicks an item (not drag) → `(keySelect)` fires `onTertiaryNavSelect('nav3', 'charts')` → `scrollToNav('nav3')` finds the matching `.chart-target` ref in `nav_elements` (a `QueryList` of all `#summary1,#summary2,#nav1..#nav6` empty divs that sit at the top of each card) and calls `scrollIntoView({behavior:'smooth', block:'start'})` after a 5ms timeout.

### 6. Mobile layout

`device_type()` is `'mobile'` (XSmall breakpoint). Differences:
- Nutalytics title block is hidden — no "Archiving…" indicator surfaces on mobile.
- Control's `@if (device_type() === 'desktop')` block hides Date range + Interval form fields. They re-render *inside* the Filters menu on mobile (see Child components).
- The desktop tertiary nav rail (`mint-chart-tertiary-nav`) is gated on `device_type() === 'desktop'` and disappears.
- A "Charts" button replaces it, opening `chart_order_menu` (a `mat-menu` containing the same `orc-nav-tertiary` with `[draggable]="false"` — items are tap-to-scroll only on mobile, not reorderable).
- Each chart card hides the inline legend and exposes a "Legend" button that opens a `legend_menu` (Balance Sheet and Ecash Counts only — the generic `orc-mint-subsection-dashboard-chart` uses Chart.js's built-in top legend).

### 7. Tablet layout

`device_type()` is `'tablet'` (Small or Medium breakpoint).
- Nutalytics title block hidden (same gate as mobile).
- Control's date / interval / filters are all visible (the desktop branch).
- Right-rail tertiary nav hidden.
- The mobile Charts menu is *also* hidden (the mobile menu only renders when `device_type() !== 'desktop'`, so on tablet it shows too — see template line 99). Charts rely solely on scroll order; no quick-jump navigation surfaces.

### 8. No lightning enabled

`lightning_enabled === false` → `loadLightningAnalytics()` is skipped, `lightning_balance` stays `null`, `lightning_analytics` stays `[]`. The Balance Sheet chart's "Asset" dataset (lightning local balance) is not added. The `Assets` legend group disappears entirely — only `Liabilities` remains.

### 9. Bitcoin oracle disabled

`bitcoin_oracle_enabled === false` → no oracle subscription, `bitcoin_oracle_price_map()` stays `null`, `oracle_used` is forced to `false` in `getPageSettings()`. The "Oracle" section is hidden in the Filters menu (see child).

### 10. Unhappy: analytics fetch error

Inside `initAnalytics()`'s `try/catch` ([mint-subsection-dashboard.component.ts:390-393](../../src/client/modules/mint/modules/mint-subsection-dashboard/components/mint-subsection-dashboard/mint-subsection-dashboard.component.ts#L390)), any error in the forkJoin sets `loading_mint = false` and logs `'ERROR IN INIT ANALYTICS:'` to console. There is no UI error surface — charts render their own "no data" overlay (`bar_chart_off` icon) because their `mint_analytics` arrays remain empty. **This is the only failure mode in scope and it is silent.** Operators must read the browser console.

## Child components

### `orc-mint-subsection-dashboard-control` (Nutalytics control bar)

Source: [mint-subsection-dashboard-control.component.ts](../../src/client/modules/mint/modules/mint-subsection-dashboard/components/mint-subsection-dashboard-control/mint-subsection-dashboard-control.component.ts) · [`.html`](../../src/client/modules/mint/modules/mint-subsection-dashboard/components/mint-subsection-dashboard-control/mint-subsection-dashboard-control.component.html)

#### Parent → child data contract

| Input | Type | Source |
|---|---|---|
| `page_settings` | `NonNullableMintDashboardSettings` (required) | host's `page_settings()` signal |
| `date_start` | `number` (unix seconds) | `page_settings().date_start` |
| `date_end` | `number` (unix seconds) | `page_settings().date_end` |
| `date_preset` | `DateRangePreset \| null` | `page_settings().date_preset` |
| `units` | `MintUnit[]` | `page_settings().units` |
| `interval` | `AnalyticsInterval` | `page_settings().interval` |
| `keysets` | `MintKeyset[]` (required) | host's `mint_keysets` (route data) — used to derive the unique units list for the Filters menu |
| `loading` | `boolean` (required) | host's `loading_static_data` — gates the one-shot `initForm()` effect |
| `mint_genesis_time` | `number` (required) | host's `mint_genesis_time` — used to highlight the genesis day in the date-picker calendar (`mint-genesis-date-class`) |
| `device_type` | `'desktop' \| 'tablet' \| 'mobile'` (required) | host's `device_type()` |
| `bitcoin_oracle_enabled` | `boolean` (required) | host's `bitcoin_oracle_enabled` |

#### Outputs

| Output | Payload | Host handler |
|---|---|---|
| `dateChange` | `[date_start, date_end]` (unix seconds) | `onDateChange` — clears `date_preset` |
| `presetChange` | `DateRangePreset` | `onPresetChange` — resolves preset → dates via `resolveDateRangePreset(preset, mint_genesis_time)`, sets `date_preset` |
| `unitsChange` | `MintUnit[]` | `onUnitsChange` |
| `intervalChange` | `AnalyticsInterval` | `onIntervalChange` |
| `oracleUsedChange` | `boolean` | `onOracleUsedChange` — settings-only, does NOT call `reloadDynamicData()` |

#### Internal state

- `panel: FormGroup` with `daterange.{date_start,date_end}` (DateTime), `units: FormArray<FormControl<boolean>>`, `interval`, `oracle_used`.
- `unit_options` — built once from `Set(keysets().map(k => k.unit))`, uppercased label.
- `interval_options` — fixed `[Hour, Day, Week, Month]`.
- `filter_count` — signal incremented for `units.length > 0` and `oracle_used === true` (max 2). Shown next to "Filters" as `Filters (N)` when > 0.
- `genesis_class: MatCalendarCellClassFunction` — paints the calendar cell whose day-window contains `mint_genesis_time` with class `mint-genesis-date-class`.
- `initForm()` runs once when `loading()` first flips false (via an `effect` + `untracked`), populating all controls. Subsequent input changes are synced into the form via four narrow `effect`s (date_start, date_end, units, interval) — each guarded by an equality check to avoid emit loops.

#### Reachable child states

##### Desktop layout

- Date range field (`mat-form-field` with `mat-date-range-input`) + scroll-picker icon-suffix → opens preset/calendar dropdown.
- Interval `mat-select` with options `Hour | Day | Week | Month`.
- Filters button → opens `filter_menu`.
- The form has an `orc-animation-form-reaction` wrapper that flips `animation-invalid` when `panel.invalid` (e.g. user clears the start date) — drives a subtle shake animation, no error message overlay beyond the form-field's own `<mat-error>"Invalid date range"</mat-error>`.

##### Mobile / tablet layout

- Only the Filters button renders inline. Date range and Interval are inside the Filters menu (see below).
- Same form, same change-detection — only the projection differs.

##### Filter menu, oracle disabled

Sections: **Units** (one `mat-checkbox` per unique keyset unit) + "Clear all" footer.

##### Filter menu, oracle enabled

Sections: **Oracle** (single "Convert prices" `mat-checkbox` bound to `panel.controls.oracle_used`) → divider → (mobile only: Date range + Interval form fields) → **Units** → "Clear all" footer.

##### Filter menu — Clear all click

`onClearFilter()` emits `unitsChange([])` (does NOT clear oracle_used) and resets `filter_count` to 0. The menu closes via `filter_menu_trigger().closeMenu()`.

##### Filter menu — × Close click

`onCloseFilter()` closes via `filter_menu_trigger().closeMenu()`. No emissions.

##### Date scroll-picker open

`orc-form-daterange-scroll-picker` renders a left-column preset list (`Last 7 days`, `Last 30 days`, `Last 90 days`, `This Quarter`, `This Year`, `Last Year`, `All Time`) and a two-month calendar pair. Selecting a preset emits `(presetChange)`; clicking calendar days emits `(dateRangeChange)` which the control routes through `onDateChange()` (Math.floor of `toSeconds()` for start; `endOf('day').toSeconds()` for end). The genesis day is highlighted with `mint-genesis-date-class`.

##### `isValidChange` gate

Every emit (`onDateChange`, `onUnitsChange`, `onIntervalChange`, `onOracleUsedChange`) first calls `isValidChange()` ([mint-subsection-dashboard-control.component.ts:230-243](../../src/client/modules/mint/modules/mint-subsection-dashboard/components/mint-subsection-dashboard-control/mint-subsection-dashboard-control.component.ts#L230)) which returns false if no field actually differs from `page_settings()`. This is what stops the input-syncing effects from re-emitting their own values back to the parent. **Practical effect**: programmatic resets (e.g. picking a preset that resolves to the current dates) do not re-fetch.

#### Closing + propagation back

The control has no internal close. The parent persists settings synchronously on each emit and triggers data reload (except for `oracleUsedChange`, which is settings-only).

### `orc-mint-subsection-dashboard-balance-chart` (Balance Sheet card)

Source: [mint-subsection-dashboard-balance-chart.component.ts](../../src/client/modules/mint/modules/mint-subsection-dashboard/components/mint-subsection-dashboard-balance-chart/mint-subsection-dashboard-balance-chart.component.ts) · [`.html`](../../src/client/modules/mint/modules/mint-subsection-dashboard/components/mint-subsection-dashboard-balance-chart/mint-subsection-dashboard-balance-chart.component.html)

#### Parent → child data contract

| Input | Source |
|---|---|
| `locale` | `await settingDeviceService.getLocale()` |
| `mint_analytics` / `mint_analytics_pre` | `mint_analytics_balances` / `…_pre` from `mintAnalyticsBalances` query (current window + pre window) |
| `bitcoin_oracle_price_map` | `bitcoin_oracle_price_map()` |
| `lightning_balance` / `lightning_analytics` / `lightning_analytics_pre` | `loadLightningBalance()` + `lightningAnalyticsLocalBalance` × 2 |
| `page_settings` / `oracle_used` / `mint_genesis_time` / `selected_type` / `loading` / `lightning_enabled` / `device_mobile` | host signals/fields |
| `mint_balances` / `mint_keysets` | route data — joined into `getLiveBalanceByUnit()` so the rightmost cumulative liability point is corrected to live |

#### Computed signals

- `liability_datasets` — datasets with `_type === 'liability'` (one per mint unit)
- `asset_datasets` — datasets with `_type === 'asset'` (lightning local balance, sat-converted from msat)

#### Reachable states

##### Totals (default)

`selected_type === 'totals'` → `chart_type = 'line'`. Builds cumulative area datasets:
- One liability per unit (filled, solid border) — cumulative running total of `issued − redeemed`. Last point is corrected via `correctLastPointWithLiveBalance(unit, mint.balance(unit))` so it matches the live ecash supply even if backfill hasn't caught up.
- If `lightning_enabled` and lightning analytics non-empty: one asset (filled, **dashed border**) — cumulative LN local balance, last point corrected to `LocalAmountPipe.getConvertedAmount('sat', lightning_balance.open.local_balance)`.
- Glow plugin attached using the first dataset's border colour.

##### Volume

`selected_type === 'volume'` → `chart_type = 'bar'`. Per-bucket non-cumulative deltas. Liability bars filled, asset bars rendered with `createStripePattern(asset_color.border)` for the diagonal-stripe asset look.

##### Loading overlay

`loading()` true → spinner overlay over the canvas. Geometry stays.

##### Empty (no data, all four arrays empty)

`mint_analytics`, `mint_analytics_pre`, `lightning_analytics`, `lightning_analytics_pre` all empty → `bar_chart_off` icon overlay. Inline legend chips also disappear because `liability_datasets()` and `asset_datasets()` resolve to `[]`.

##### Oracle on

`page_settings().oracle_used === true` AND `bitcoin_oracle_price_map().size > 0` → `canUseOracle()` true → BTC-eligible units (`btc`/`sat`/`msat`) get converted via `convertChartDataWithOracle(value, unit, oracle_map, true)`. Y-axis switches from `ybtc` to `yfiat` (cents). Tooltip labels switch to `formatOracleTooltipLabel(_, true)`.

##### Mobile legend

`device_mobile === true` → inline legend chips replaced by a single "Legend" button → opens `legend_menu` showing two columns (Assets / Liabilities) of the same toggleable items.

##### Dataset toggle

Click any legend chip → `toggleDataset(dataset)` flips `chart.setDatasetVisibility(index, !visible)`, mutates `hidden_datasets` set, applies `.hidden-dataset` strikethrough class to the label. Hidden datasets are *re-applied* after every `init()` via `applyHiddenDatasets()` so toggle state survives data refreshes.

##### Mint Genesis annotation

`getAnnotations()` only renders the vertical "Mint Genesis" line if `startOfDay(mint_genesis_time).millis >= min(x_values)`. If the user picks a date range entirely after genesis, the annotation is suppressed.

#### Interactions

| Gesture | Target | Result |
|---|---|---|
| click legend chip | `.legend-item` (desktop) or `mat-menu` item (mobile) | toggles dataset visibility, persists in `hidden_datasets` |
| hover canvas | `chart.js` | tooltip with `Assets / Liabilities` headers, items sorted asset → liability |

### `orc-mint-subsection-dashboard-chart` (generic chart — used by Mints, Melts, Swaps, Fee Revenue)

Source: [mint-subsection-dashboard-chart.component.ts](../../src/client/modules/mint/modules/mint-subsection-dashboard/components/mint-subsection-dashboard-chart/mint-subsection-dashboard-chart.component.ts) · [`.html`](../../src/client/modules/mint/modules/mint-subsection-dashboard/components/mint-subsection-dashboard-chart/mint-subsection-dashboard-chart.component.html)

Used **four times** by the host — one instance for each of: Mints (`mint_analytics_mints`), Melts (`mint_analytics_melts`), Swaps (`mint_analytics_swaps`), Fee Revenue (`mint_analytics_fees`). All four share the same template; the parent differentiates them only by which `mint_analytics_*` pair is wired in and which `selected_type` is bound.

#### Parent → child data contract

| Input | Source (parametrised by chart) |
|---|---|
| `locale` | host locale |
| `bitcoin_oracle_price_map` | host signal |
| `mint_analytics` / `mint_analytics_pre` | one of `mint_analytics_{mints,melts,swaps,fees}` and its `_pre` sibling |
| `page_settings` / `oracle_used` / `mint_genesis_time` | host signals/fields |
| `selected_type` | one of `type_mints()`, `type_melts()`, `type_swaps()`, `type_fee_revenue()` |
| `loading` | `loading_analytics()` |

#### Computed signals

- `has_data` — `chart_data.datasets.length > 0 && (mint_analytics().length > 0 || mint_analytics_pre().length > 0)`. Drives the "no data" overlay.

#### Reachable states (per instance — each chart can independently be in any of these)

- **Totals** — line chart, cumulative `getAmountData(_, true)`. Glow plugin enabled. Uses `prepend = true` so the pre-window's running total carries into the leftmost point.
- **Volume** — bar chart, per-bucket `getAmountData(_, false)`. `prepend = false`. No glow.
- **Loading overlay** — `loading()` true. Same `mat-progress-spinner`.
- **Empty** — `!loading() && !has_data()` → `bar_chart_off` icon overlay. Reachable when the chart's metric simply has no data in the window (e.g. fresh mint with no melts).
- **Oracle on** — same `canUseOracle()` semantics as Balance Sheet; BTC units render against the cents y-axis.
- **Type-toggle change** — `ngOnChanges` watches `selected_type`, `oracle_used`, and `loading` (after first-change). Any change re-runs `init()`, which rebuilds `chart_data` and `chart_options` and resizes the canvas (`setTimeout(() => chart.chart?.resize())`).

#### Fee Revenue parent overlays (NOT inside the chart component itself)

The parent template wraps the Fee Revenue instance in a `.relative` div and conditionally renders one of two overlays *over* the chart ([mint-subsection-dashboard.component.html:272-293](../../src/client/modules/mint/modules/mint-subsection-dashboard/components/mint-subsection-dashboard/mint-subsection-dashboard.component.html#L272)):

| Condition | Overlay |
|---|---|
| `!loading_analytics() && mint_type === 'nutshell' && mint_fee_revenue() && mint_watchdog_status?.is_alive === false` | `sound_detection_dog_barking` icon + "Nutshells watchdog required for analytics" |
| `!loading_analytics() && !mint_fee_revenue()` | `money_off` icon + "No fee revenue" |
| else | nothing — chart renders normally (or its own "no data" overlay if it has zero buckets) |

`mint_fee_revenue()` is set once during `ngOnInit` from `getMintFeeRevenueState()` which sums `keyset.fees_paid` across all keysets — so a mint with non-zero fees-collected on at least one keyset never shows the "No fee revenue" overlay even if the current window is empty.

`mint_watchdog_status` is only fetched when `mint_type === 'nutshell'` — for cdk it's always `null`, so the watchdog overlay is unreachable on cdk stacks.

### `orc-mint-subsection-dashboard-ecash-chart` (Ecash Counts card)

Source: [mint-subsection-dashboard-ecash-chart.component.ts](../../src/client/modules/mint/modules/mint-subsection-dashboard/components/mint-subsection-dashboard-ecash-chart/mint-subsection-dashboard-ecash-chart.component.ts) · [`.html`](../../src/client/modules/mint/modules/mint-subsection-dashboard/components/mint-subsection-dashboard-ecash-chart/mint-subsection-dashboard-ecash-chart.component.html)

#### Parent → child data contract

| Input | Source |
|---|---|
| `locale` | host locale |
| `mint_analytics_proofs` / `mint_analytics_proofs_pre` | `mint_analytics_proofs` query × 2 |
| `mint_analytics_promises` / `mint_analytics_promises_pre` | `mint_analytics_promises` query × 2 |
| `page_settings` / `mint_genesis_time` / `selected_type` / `loading` / `device_mobile` | host signals |

Note: this chart does NOT take `bitcoin_oracle_price_map` or `oracle_used` — counts are unitless, no conversion applies.

#### Computed signals

- `proof_datasets` — datasets with `_type === 'proof'` (dashed style).
- `promise_datasets` — datasets with `_type === 'promise'` (solid style).

#### Reachable states

##### Totals (default)

`chart_type = 'line'`, stacked area. Promises render first (bottom of stack, solid), proofs on top (dashed). `getCountData(_, true)` = cumulative running counts.

##### Volume

`chart_type = 'bar'`, stacked bars on `stack: 'counts'`. Promises filled, proofs striped (`createStripePattern(color.border)`). `getCountData(_, false)` = per-bucket counts.

##### Loading / Empty / Mint Genesis annotation / Mobile legend / Dataset toggle

Same shape as Balance Sheet (loading spinner; `bar_chart_off` empty overlay; Mint Genesis annotation if visible; "Legend" button on mobile opens menu with **Blind Signatures / Proofs** columns; legend toggle persists hidden indexes).

##### Tooltip semantics

Tooltip groups items by `_type` with `Proofs (received)` / `Blind Signatures (issued)` headers and a footer line `Total: N` summing the visible items. Sort order: proofs above promises in the tooltip.

## Unhappy / edge cases

- **Pre-window pagination > 50k rows**: the "pre" query uses `interval=custom`, which means the server collapses the entire history (`epoch_start → date_start − 1`) into a single bucket per unit per metric. Safe because the bucket is a sum, not a row dump.
- **`mint_keysets` empty (e.g. mint not yet provisioned)**: `mint_genesis_time = 0` (Math.min of empty array would be Infinity, but the `?? []` guard returns 0). Mint Genesis annotation lines render at the Unix epoch — way to the left of any data — and `display = milli_genesis_time >= min(x_values)` evaluates false, so the annotation is suppressed. Filter menu's Units list is empty too.
- **`page_settings` returns null from `getMintDashboardSettings()`**: defaults fill in via the `??` chain in `getPageSettings()` so `page_settings()` is never null. The control is gated `@if (page_settings())` for safety only.
- **`loading_analytics` flickers true→false→true**: each chart's `ngOnChanges` re-runs `init()` only when `loading` flips from non-firstChange `true → false`. Rapid flips don't double-init.
- **Oracle map empty**: `canUseOracle()` requires `oracle_map.size > 0`, so a half-loaded oracle (network hiccup) renders BTC against `ybtc` axis until the map populates.
- **Hour interval over a 90-day range**: 2160 buckets × 7 metrics = wide-but-flat chart; no pagination guard. Performance degrades linearly with bucket count.
- **`reloadDynamicData()` error**: caught and logged; `loading_mint` is *not* reset on the catch path ([mint-subsection-dashboard.component.ts:497-510](../../src/client/modules/mint/modules/mint-subsection-dashboard/components/mint-subsection-dashboard/mint-subsection-dashboard.component.ts#L497) — `try` body sets it false but `catch` does not, so a failed reload leaves `loading_mint = true` indefinitely until the next change). Spinner overlays would persist on every chart. *This looks like a bug worth flagging.*
- **`computeArchivingProgress` with `first_processed_at = last_processed_at`**: `processed_seconds = 0`, fraction → 0, `Math.floor(0 * 100) = 0`. Bar reads 0% even mid-stream until the first record's window opens.

## Template structure (at a glance)

```
.dashboard-container
├── (summary cards — out of scope: Mint summary + orc-mint-general-balance-sheet)
├── .mint-analytic-control-panel
│   ├── @if desktop: .title-l "Nutalytics" [+ "Archiving…" sub] [+ orc-progress-bar]
│   ├── orc-mint-subsection-dashboard-control   ← child #1
│   └── @if !desktop: button "Charts" [matMenuTriggerFor=chart_order_menu]
└── .flex
    ├── #chart_container (CSS grid, areas driven by chart_nav)
    │   ├── .chart-balance-sheet [#nav1]
    │   │   ├── header: title + chart-type menu trigger
    │   │   └── orc-mint-subsection-dashboard-balance-chart   ← child #2
    │   ├── .chart-mints           [#nav2] → orc-mint-subsection-dashboard-chart   ← child #3
    │   ├── .chart-melts           [#nav3] → orc-mint-subsection-dashboard-chart   ← child #4
    │   ├── .chart-swaps           [#nav4] → orc-mint-subsection-dashboard-chart   ← child #5
    │   ├── .chart-fee-revenue     [#nav5] → orc-mint-subsection-dashboard-chart   ← child #6
    │   │     + @if conditional .orc-surface-bg overlay (watchdog / no-fee-revenue)
    │   └── .chart-ecash           [#nav6] → orc-mint-subsection-dashboard-ecash-chart   ← child #7
    └── @if desktop: .mint-chart-tertiary-nav (Summary + Charts orc-nav-tertiary x 2)

mat-menu #chart_type_menu — Totals | Volume per chart
mat-menu #chart_order_menu — mobile: orc-nav-tertiary [draggable=false]
```

## Interaction summary

| Gesture | Target | Result |
|---|---|---|
| click "Filters" button | `orc-mint-subsection-dashboard-control button:has-text("Filters")` | opens `filter_menu` overlay |
| toggle a unit checkbox | `mat-checkbox` inside Units section | emits `unitsChange(units[])` → host persists + reloads analytics |
| toggle "Convert prices" | `mat-checkbox` in Oracle section | emits `oracleUsedChange(boolean)` → host persists, NO reload (charts repaint locally) |
| click "Clear all" | filter menu footer | emits `unitsChange([])`, resets `filter_count`, closes menu |
| click × Close | filter menu header | closes menu |
| open Interval select + pick option | `orc-mint-subsection-dashboard-control mat-select` then `mat-option[Hour\|Day\|Week\|Month]` | emits `intervalChange(value)` → host persists + reloads |
| open date scroll-picker | `orc-form-daterange-scroll-picker` icon-suffix | opens preset/calendar overlay |
| pick a preset | preset list item | emits `presetChange(preset)` → host resolves dates + reloads |
| pick calendar range | calendar day click (start, then end) | emits `dateRangeChange(range)` → control routes to `dateChange([start, end])` → host persists + reloads |
| open chart-type menu | `.chart-{key} .mint-analytic-selector button` | opens `chart_type_menu` with `Totals` / `Volume` |
| pick a chart type | `mat-menu-item` in chart-type menu | host calls `onChartTypeChange(chart_key, type)` → settings persisted → that chart's `ngOnChanges` repaints; other charts untouched |
| drag Charts tertiary-nav item *(desktop)* | `.mint-chart-tertiary-nav orc-nav-tertiary` (Charts panel) | emits `(orderChange)` → host updates `chart_nav`, reflows grid via `updateGridNav` |
| click Charts tertiary-nav item *(desktop)* | same | emits `(keySelect)` → host scrolls into view |
| drag Summary tertiary-nav item | `.mint-chart-tertiary-nav orc-nav-tertiary` (Summary panel) | emits `(orderChange)` → host reflows summary grid |
| click "Charts" button *(mobile)* | `button:has-text("Charts")` | opens `chart_order_menu`; items are tap-to-scroll only |
| toggle legend chip *(in Balance Sheet)* | `.legend-item` | child's `toggleDataset` hides/shows that unit's dataset |
| toggle legend chip *(in Ecash Counts)* | `.legend-item` | same; persisted per child instance |
| click "Legend" button *(mobile, BS or Ecash)* | mobile-legend `button` | opens `legend_menu` with Asset/Liability or Blind-Sigs/Proofs columns |
| hover any chart canvas | Chart.js | tooltip with grouped labels (assets/liabilities or proofs/promises) |

## Test-author handoff

### Host page + setup

- `await page.goto('/mint')`. Auth via `loginViaUi(page)` from `e2e/helpers/ui` (no storageState recipe yet).
- `beforeEach`: log in, goto, wait for `orc-mint-subsection-dashboard-control` to be attached AND `orc-mint-subsection-dashboard-balance-chart canvas` to be visible (signals first analytics fetch settled).
- Tag: `@mint @canary` for the control + smoke-render assertion; `@mint` (no canary) for chart-type and filter interactions.

### Differential oracles

Data accuracy is the spec's first-class concern. Each chart input must be asserted against the mint daemon's source, not against fixture-frozen values.

| Input (host field) | GraphQL resolver | Server source | Existing helper | Gap |
|---|---|---|---|---|
| `mint_analytics_balances` | `mint_analytics_balances` ([mintanalytics.resolver.ts:21](../../src/server/modules/api/mint/analytics/mintanalytics.resolver.ts#L21)) | `MintAnalytics` cache, metrics `[issued_amount, redeemed_amount]`; cache populated by streaming mint daemon's `mint_quotes` + `proofs/proofs_used` ([cashu mintanalytics.service.ts](../../src/server/modules/cashu/mintanalytics/mintanalytics.service.ts)) | `mint.balance(config, unit)` reads daemon DB directly (live) | Add `mint.analyticsBalanceWindow(config, {unit, date_start, date_end, last_processed_at})` that mirrors `getMintAnalyticsBalances` summing `issued − redeemed` per hour bucket capped at backfill ceiling. Then assert chart's last cumulative point per unit matches `mint.balance(unit)` and bucket sums match the new oracle. |
| `mint_analytics_mints` | `mint_analytics_mints` resolver → `getMetricAnalytics([mints_amount])` | sum of `mint_quote.amount_issued` (cdk) / `mint_quotes.amount WHERE state='ISSUED'` (nutshell) per hour bucket. Same window math as `activitySummaryOracle`. | `mint.activitySummaryOracle(config, {last_processed_at})` returns `mint_amount_issued` over a single window | Add `mint.metricsWindow(config, {metric: 'mints_amount', date_start, date_end, last_processed_at})` returning the same per-bucket sums the chart renders. |
| `mint_analytics_melts` | `mint_analytics_melts` → `[melts_amount]` | `melt_quote.amount WHERE state='PAID'` (cdk + nutshell) per hour bucket | `mint.activitySummaryOracle.melt_amount_paid` | Same gap — extend per-metric. |
| `mint_analytics_swaps` | `mint_analytics_swaps` → `[swaps_amount]` | `completed_operations.total_redeemed WHERE operation_kind='swap'` (cdk) / grouped `proofs_used WHERE melt_quote IS NULL` (nutshell) | `mint.activitySummaryOracle.swap_amount` | Same gap. |
| `mint_analytics_fees` | `mint_analytics_fees` → `[fees_amount]` | `mint_operation_fees`-style aggregation (cdk: cdk.service.ts; nutshell: derived from `proofs_used.fee_paid`) | `mint.feesPaid(config, unit)` reads `keyset_amounts.fee_collected` / `keysets.fees_paid` (live total) | Add `mint.feesWindow(config, {unit, date_start, date_end, last_processed_at})` for per-bucket fee sums. |
| `mint_analytics_proofs` | `mint_analytics_proofs` → `[redeemed_amount]` (counts mode) | `proof.created_time` (cdk) / `proofs_used.created` (nutshell) row counts per hour bucket | `mint.keysetCountsOracle(config, {last_processed_at}).total_proofs` returns the global count up to ceiling | Add `mint.proofsWindow(config, {date_start, date_end, last_processed_at})` for per-bucket counts. |
| `mint_analytics_promises` | `mint_analytics_promises` → `[issued_amount]` (counts mode) | `blind_signature.created_time` (cdk) / `promises.created` (nutshell) | `mint.keysetCountsOracle(_).total_promises` | Add `mint.promisesWindow(_)`. |
| `lightning_analytics` | `lightning_analytics_local_balance` resolver | derived in lightning.service from per-channel snapshot history — out of mint scope | `ln.localChannelBalance(config)` reads live `listchannels` / `listpeerchannels` | Asset *last point* assertion uses `ln.localChannelBalance` directly; per-bucket assertion needs an LN analytics oracle (separate spec). |
| `bitcoin_oracle_price_map` | `bitcoin_oracle_price_map(date_start, date_end)` | bitcoin oracle service, hourly closing prices | `orchard.oraclePrice(config)` returns *spot* price, no map helper | Add `orchard.oraclePriceMap(config, {date_start, date_end})` if the spec wants to assert oracle-converted chart values precisely; otherwise assert "oracle on → y-axis label switches to USD" only. |
| `mint_analytics_backfill_status` | `mint_analytics_backfill_status` resolver (synchronous getter) | in-memory `backfill_status` on `cashuMintAnalyticsService` | none | No oracle possible — this is the source of truth. Spec only needs to *trigger* archiving (e.g. POST `/api/admin/.../trigger-backfill` if such an endpoint exists, or wait for the natural `:05` cron — neither is e2e-friendly). Mark archiving-state assertions as `disruptive`. |
| `mint_keysets` (for genesis line) | `mint_keysets` resolver | live keyset rows | `mint.keysets(config)` | Genesis = `Math.min(...keysets.map(k => k.valid_from))`. Asserting "Mint Genesis annotation present iff genesis is in window" pivots on this. |

### State reachability matrix

| State | lnd-nutshell-sqlite | lnd-cdk-sqlite | cln-cdk-postgres | cln-nutshell-postgres |
|---|---|---|---|---|
| 1. Default render | ✓ live | ✓ live | ✓ live | ✓ live |
| 2. Archiving in progress | — disruptive | — disruptive | — disruptive | — disruptive |
| 3. Loading (initial) | ✓ live (race the spinner before forkJoin settles) | ✓ live | ✓ live | ✓ live |
| 4. Reordering charts | ✓ live | ✓ live | ✓ live | ✓ live |
| 5. Scroll-into-view via nav | ✓ live | ✓ live | ✓ live | ✓ live |
| 6. Mobile layout | ✓ live (resize viewport) | ✓ live | ✓ live | ✓ live |
| 7. Tablet layout | ✓ live (resize viewport) | ✓ live | ✓ live | ✓ live |
| 8. No lightning enabled | — synthetic (toggle `lightning_enabled` constructor field) | — synthetic | — synthetic | — synthetic — every shipped stack runs LN |
| 9. Bitcoin oracle disabled | ✓ live (default; oracle off in test stacks) | ✓ live | ✓ live | ✓ live |
| 10. Analytics fetch error | — disruptive (`docker pause cdk-mintd` / `docker pause nutshell` to break the upstream backfill, then trigger reload) | — disruptive | — disruptive | — disruptive |
| Control: Filters menu (no oracle) | ✓ live | ✓ live | ✓ live | ✓ live |
| Control: Filters menu (oracle on) | — synthetic (toggle the `bitcoin_oracle` app setting then reload) | — synthetic | — synthetic | — synthetic |
| Control: Date scroll-picker open | ✓ live | ✓ live | ✓ live | ✓ live |
| Control: Interval select open | ✓ live | ✓ live | ✓ live | ✓ live |
| Balance Sheet — Totals | ✓ live | ✓ live | ✓ live | ✓ live |
| Balance Sheet — Volume | ✓ live | ✓ live | ✓ live | ✓ live |
| Balance Sheet — Loading | ✓ live | ✓ live | ✓ live | ✓ live |
| Balance Sheet — Empty | — synthetic (override `mint_analytics_balances` to `[]`) | — synthetic | — synthetic | — synthetic |
| Balance Sheet — Oracle on | — synthetic | — synthetic | — synthetic | — synthetic |
| Balance Sheet — Mobile legend menu | ✓ live | ✓ live | ✓ live | ✓ live |
| Balance Sheet — Dataset toggle | ✓ live | ✓ live | ✓ live | ✓ live |
| Mints/Melts/Swaps/Fees — Totals | ✓ live | ✓ live | ✓ live | ✓ live |
| Mints/Melts/Swaps/Fees — Volume | ✓ live | ✓ live | ✓ live | ✓ live |
| Mints/Melts/Swaps/Fees — Loading | ✓ live | ✓ live | ✓ live | ✓ live |
| Mints/Melts/Swaps/Fees — Empty | ✓ live (pick a date range outside data) | ✓ live | ✓ live | ✓ live |
| Fee Revenue — "No fee revenue" overlay | — synthetic (regtest fixtures generate fees on first melt) | — synthetic | — synthetic | — synthetic |
| Fee Revenue — "Watchdog required" overlay | — synthetic (`docker pause` the nutshell watchdog sidecar — does the test stack ship one? no) | — dead-branch (cdk only; `mint_type !== 'nutshell'`) | — dead-branch | — synthetic |
| Ecash Counts — Totals | ✓ live | ✓ live | ✓ live | ✓ live |
| Ecash Counts — Volume | ✓ live | ✓ live | ✓ live | ✓ live |
| Ecash Counts — Loading | ✓ live | ✓ live | ✓ live | ✓ live |
| Ecash Counts — Empty | ✓ live (range outside data) | ✓ live | ✓ live | ✓ live |
| Ecash Counts — Mobile legend menu | ✓ live | ✓ live | ✓ live | ✓ live |
| Mint Genesis annotation visible | ✓ live (default 3-month window covers genesis) | ✓ live | ✓ live | ✓ live |
| Mint Genesis annotation suppressed | — synthetic (pick a range entirely after genesis — but genesis is "today" in regtest, so `All Time` always includes it) | — synthetic | — synthetic | — synthetic |

### Per-state probes

| State | Settled signal | Primary assert |
|---|---|---|
| 1. Default render | `orc-mint-subsection-dashboard-balance-chart canvas` visible | `expect(page.locator('.title-l:has-text("Nutalytics")')).toBeVisible()` AND `expect(page.locator('.chart-balance-sheet, .chart-mints, .chart-melts, .chart-swaps, .chart-fee-revenue, .chart-ecash')).toHaveCount(6)` |
| 2. Archiving | `.title-l span.orc-status-warning-color:has-text("Archiving…")` | progress bar `[role="progressbar"]` under title with `aria-valuenow` between 0 and 99 |
| 3. Loading | `.chart-balance-sheet mat-progress-spinner` | spinner present on every `.chart-{key}` card |
| 4. Reorder | `.mint-chart-tertiary-nav orc-nav-tertiary[draggable]` (Charts) | drag item index 0 → 5, then assert `.chart-balance-sheet` `getBoundingClientRect().top > .chart-ecash.top` |
| 5. Scroll-into-view | `.mint-chart-tertiary-nav button:has-text("Melts")` | click → `.chart-melts` is in viewport (`getBoundingClientRect().top` between 0 and viewport height) |
| 6. Mobile | `button:has-text("Charts")` (the trigger) | `expect(page.locator('orc-mint-subsection-dashboard-control input[matStartDate]')).toHaveCount(0)` AND `expect(page.locator('orc-mint-subsection-dashboard-control button:has-text("Filters"))).toBeVisible()` |
| 7. Tablet | viewport 768×1024, `.mint-chart-tertiary-nav` not in DOM | both Date range AND Filters visible inline; no Charts mobile menu trigger |
| 8. No lightning | `.chart-balance-sheet` has only Liabilities legend, no Assets group | dataset count check via `window.ng.getComponent(...).asset_datasets().length === 0` (note: requires app exposing ng to window — Angular dev mode does) |
| 9. Oracle disabled | filters menu lacks "Oracle" section | open filter menu, `expect(page.locator('.cdk-overlay-container').getByText('Oracle')).toHaveCount(0)` |
| 10. Analytics error | `mat-icon[data-mat-icon-name="bar_chart_off"]` on every chart | only via console-error inspection; no UI affordance |
| Control: Filters menu (no oracle) | `.cdk-overlay-container .orc-filter-menu` | Units checkboxes count === unique units in `mint.keysets(config)` |
| Control: Filters menu (oracle on) | `.cdk-overlay-container .orc-filter-menu mat-checkbox:has-text("Convert prices")` | Oracle section present + Units present |
| Control: Date scroll-picker | `.cdk-overlay-container button:has-text("All Time")` | preset list visible + calendar visible |
| Control: Interval select | `.cdk-overlay-container mat-option:has-text("Hour")` | 4 options present (Hour/Day/Week/Month) |
| Balance Sheet — Totals | `.chart-balance-sheet canvas` AND legend chip `.legend-item:has-text("SAT")` | `window.ng.getComponent(document.querySelector('orc-mint-subsection-dashboard-balance-chart')).chart_type === 'line'`; rightmost cumulative point (read from `chart_data().datasets[0].data.at(-1).y`) equals `mint.balance(config, 'sat')` |
| Balance Sheet — Volume | same canvas | `chart_type === 'bar'`; sum of liability bars over all visible buckets equals oracle window sum |
| Balance Sheet — Loading | `.chart-balance-sheet mat-progress-spinner` | spinner present; canvas still in DOM |
| Balance Sheet — Empty | `.chart-balance-sheet mat-icon[fontIcon] :has-text` containing `bar_chart_off` (or by `mat-icon` text) | `chart_data().datasets.length === 0` |
| Balance Sheet — Oracle on | y-axis tick labels formatted as USD cents | toggle Convert prices, then read first `.chart-balance-sheet canvas` → `chartInstance.scales.yfiat` exists |
| Balance Sheet — Mobile legend menu | `.cdk-overlay-container :has-text("Assets")` AND `:has-text("Liabilities")` | resize → mobile, click Legend, two columns visible |
| Balance Sheet — Dataset toggle | `.chart-balance-sheet .legend-item .legend-item-label.hidden-dataset` | click first chip; class applied + `chart.isDatasetVisible(0) === false` |
| Mints — Totals (and ditto Melts/Swaps/Fees) | `.chart-mints canvas` | `chart_type === 'line'`; cumulative window sum equals oracle (see Differential oracles row) |
| Mints — Volume | same | `chart_type === 'bar'` |
| Mints — Empty | `.chart-mints mat-icon` (bar_chart_off) | pick All Time then a 1-second window starting before any data; assert overlay |
| Fee Revenue — "No fee revenue" overlay | `.chart-fee-revenue .orc-surface-bg :has-text("No fee revenue")` | only reachable on a fresh mint with `keyset.fees_paid === 0`; mark `fixture-only` |
| Fee Revenue — Watchdog overlay | `.chart-fee-revenue .orc-surface-bg :has-text("Nutshells watchdog required")` | requires nutshell + paused watchdog; mark `disruptive` |
| Ecash — Totals | `.chart-ecash canvas` | `chart_type === 'line'`; per-unit cumulative rightmost point equals `mint.keysetCountsOracle(_).total_promises` (for promises dataset) |
| Ecash — Volume | same | `chart_type === 'bar'` stacked |
| Ecash — Empty | `.chart-ecash mat-icon` (bar_chart_off) | range outside data |
| Ecash — Mobile legend | `.cdk-overlay-container :has-text("Blind Signatures")` AND `:has-text("Proofs")` | mobile-only |
| Mint Genesis annotation | inspect `chartInstance.options.plugins.annotation.annotations.annotation.display === true` | only true when `genesis_time` falls within the visible x-range |

### Reusable interaction recipes

- **Open a `mat-select` reliably**: Playwright's `.click()` works for the Interval select (verified in this session's preview probe). Don't `.fill()` it — it's not an input.
- **Open a `mat-menu` triggered via `[matMenuTriggerFor]`**: `.click()` on the trigger button. CDK overlay mounts after a tick — wait for `.cdk-overlay-container` to gain a child. The Filters trigger sometimes needs a programmatic `.click()` (the test session here found inline `.click()` worked from Playwright but not from `preview_eval` of `el.click()` alone — Playwright's synthesised event tree includes pointerdown which Material's MDC ripple wires off, so prefer Playwright's click over JS `.click()`).
- **Verify chart geometry without screenshots**: read `window.ng.getComponent(host).chart?.chart` (the `BaseChartDirective.chart` property — only available after first render) and assert `.scales.x.min`, `.scales.ybtc.max`, `.data.datasets[i].data.length`, etc. Read this *after* `await page.waitForFunction(() => window.ng.getComponent(...).chart?.chart != null)`.
- **Drive the Date range without a real calendar pick**: synthesize via `window.ng.getComponent(document.querySelector('orc-mint-subsection-dashboard')).onDateChange([start, end])`. Bypasses the form-control round-trip and the calendar overlay. Use this when the *effect* (chart re-render with new window) is what matters, not the gesture.
- **Drag the tertiary-nav reorder**: `orc-nav-tertiary` is implemented with CDK drag-drop. Playwright `.dragTo()` works but the drop preview animation is fragile; alternatively call `window.ng.getComponent(document.querySelector('orc-mint-subsection-dashboard')).onTertiaryNavChange(['nav4','nav1','nav2','nav3','nav5','nav6'], 'charts')` directly to skip the gesture and assert the grid reflows.
- **Resize for mobile**: `await page.setViewportSize({width: 375, height: 812})`. The breakpoint observer fires synchronously on the next change-detection cycle; wait for `orc-mint-subsection-dashboard-control input[matStartDate]` to *disappear* before asserting mobile structure.
- **Force loading state for assertion**: there is no UI gesture that re-enters loading. Override the signal: `window.ng.getComponent(document.querySelector('orc-mint-subsection-dashboard')).loading_mint.set(true); window.ng.applyChanges(...)`.

### Skip taxonomy

Applied below in §15. Tags used here:
- `fixture-only` — would need a recorded fixture or a custom seed (e.g. zero-fee mint to assert "No fee revenue" overlay).
- `disruptive` — needs `docker pause` / `docker stop`; would break sibling specs running in parallel.
- `unit-better` — timing or env-sensitive; covered or coverable in Karma tests.
- `stack-only` — gate to one `testInfo.project.name` (e.g. nutshell-only watchdog overlay).
- `dead-branch` — unreachable from this parent's data contract; document, do not test.

## Test fidelity hooks

There is no existing `mint-subsection-dashboard.spec.ts` yet. When written, it should at minimum cover:

1. **Smoke render** *(canary)* — page loads, control present, all 6 chart cards present, no console errors.
2. **Differential balance sheet last-point** — Balance Sheet Totals; rightmost SAT liability point equals `mint.balance(config, 'sat')`. *Anchors data-accuracy.*
3. **Differential window sum (mints)** — change Interval to Hour, then sum all volume bars in the visible window; assert equals new helper `mint.metricsWindow(config, {metric: 'mints_amount', date_start, date_end, last_processed_at})`. **Blocked on backend helper.**
4. **Filter unit toggle drops legend** — toggle SAT off in Filters; assert SAT chip removed from Balance Sheet legend AND `mint_analytics_balances` re-fetched with `units: []`-equivalent network args (read via `page.waitForRequest`).
5. **Interval change reloads** — change Interval Day → Hour; assert all 6 charts spinner-flash then repaint with denser bucket count.
6. **Chart-type toggle (Mints)** — click chart-type menu on Mints, pick Totals; assert `chart_type === 'line'` and the line is monotonically non-decreasing within the window.
7. **Chart-type toggle is per-chart** — flipping Mints to Totals leaves Melts in Volume.
8. **Mint Genesis annotation visible** — assert annotation present when default range covers genesis.
9. **Reorder via tertiary nav** — drag Balance Sheet to last; assert grid reflow.
10. **Mobile control collapses** — resize to 375; assert Date range / Interval moved into Filters menu.
11. **Bitcoin Oracle filter section absence** — default stack (oracle off): assert "Oracle" section not in filter menu.

States explicitly skipped, with taxonomy:

- **State 2 — Archiving** → `disruptive`. Backfill is a daemon-driven background job; triggering it on demand requires either an admin GraphQL endpoint (none exists per [AGENTS.md](../../AGENTS.md) and the source) or waiting for the `:05` cron — neither e2e-friendly. Cover the progress-bar math in `mint-subsection-dashboard.component.spec.ts` instead.
- **State 8 — No lightning** → `synthetic` / `unit-better`. The shipped stacks all enable lightning; toggling it requires editing `public/config.json` mid-test which other specs would race. Cover via `MintSubsectionDashboardComponent` Karma test with `lightning_enabled = false`.
- **State 10 — Analytics fetch error** → `disruptive`. `docker pause` of the cashu mint daemon kills sibling specs.
- **Control: Filters menu (oracle on)** → `synthetic`. Toggling `bitcoin_oracle` settings mid-test mutates `localStorage` in a way that survives between specs and would leak.
- **Balance Sheet / Mints / Melts / Swaps / Fees — Oracle on** → `synthetic`. Same reason. Cover oracle-conversion via `mintChartDataHelpers` Karma test (`convertChartDataWithOracle`).
- **Fee Revenue — "No fee revenue" overlay** → `fixture-only`. Regtest mints generate fees on the first melt; blocking it requires a custom fixture (a stack that sets `mint.fee_paid = 0`) which doesn't exist.
- **Fee Revenue — Watchdog overlay** → `stack-only` + `disruptive`. Only reachable on `lnd-nutshell-sqlite` / `cln-nutshell-postgres`, and only by killing the watchdog sidecar (which test stacks don't ship today). Document and skip.
- **Mint Genesis annotation suppressed** → `synthetic`. Genesis is "today" in regtest; you can't pick a range entirely after.
- **Per-chart dataset legend toggle persistence across data refresh** → `unit-better`. The `applyHiddenDatasets` re-application path is timing-sensitive and currently has Karma coverage in `mint-subsection-dashboard-balance-chart.component.spec.ts`.
- **Tertiary-nav drag-drop animation correctness** → `unit-better`. CDK drag-drop visuals are not load-bearing; e2e should call `onTertiaryNavChange(...)` synthetically and assert the grid reflow.

## Notes for implementers

- The host is `OnPush` but holds *both* signal state (`page_settings`, `device_type`, etc.) and plain class properties (`mint_analytics_balances`, `lightning_balance`, …). Mutations to plain properties require an explicit `cdr.detectChanges()` (see `getLightningBalanceSubscription`). Adding a new analytics field? Either make it a signal or follow the manual `cdr` pattern.
- The 14-call `forkJoin` in `loadMintAnalytics` is a tail-latency hotspot. The "pre" call for each metric over `epoch_start → date_start − 1` is by definition unbounded; on a long-lived production mint with months of history, those single-bucket "custom" interval queries become the slowest leg. If perf becomes an issue, the right move is to memoise the pre-window aggregates server-side (they only change when *new* hour buckets land before `date_start`).
- `reloadDynamicData()` does not reset `loading_mint` in its catch branch — a failed refetch leaves the spinner up forever. Worth fixing.
- `chart_nav` and `summary_nav` are persisted as opaque area-name arrays (`['nav4', 'nav1', …]`) but the area names are not stable across renames — adding a new chart with a new `nav7` area means existing users won't see it until they reset settings (the `??` defaults in `getPageSettings` only kick in for null/undefined, not for an array missing a new entry). Plan accordingly when adding charts.
- Chart instances are NOT destroyed on settings change — `ngOnChanges` calls `init()` which mutates `chart_data` in place and resizes. This is what preserves dataset-toggle state across data refreshes (`applyHiddenDatasets` re-applies hidden indexes after re-init).
- `mint_genesis_time = 0` for an un-provisioned mint silently disables the genesis annotation; if you ever surface a "no keysets yet" error UI here, gate it on `mint_keysets.length === 0`, not on the timestamp.
