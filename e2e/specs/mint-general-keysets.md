# `orc-mint-general-keysets`

Source: [mint-general-keysets.component.ts](../../src/client/modules/mint/modules/mint-general/components/mint-general-keysets/mint-general-keysets.component.ts) · [`.html`](../../src/client/modules/mint/modules/mint-general/components/mint-general-keysets/mint-general-keysets.component.html) · [`.scss`](../../src/client/modules/mint/modules/mint-general/components/mint-general-keysets/mint-general-keysets.component.scss)

## Purpose

The **Keysets** card on `/mint` summarising the daemon's keyset inventory and the underlying database footprint. Pure presentational container — three signal inputs, no service calls, no subscriptions, no outputs. Renders four blocks, top to bottom:

- active vs. inactive keyset count, with a horizontal fill bar showing what fraction of all keysets are active
- a `mat-chip` per distinct unit advertised by the keysets (deduplicated, schema-ordered as the daemon emitted them)
- two side-by-side stat cards — total **Blind sigs** (sum of `promise_count` across every keyset) and total **Proofs** (sum of `proof_count`), each with a sub-bar showing what fraction came from currently-active keysets
- a database-engine card with the disk size formatted to 2dp + the engine name title-cased ("Sqlite database size", "Postgres database size")

## Where it renders

- **Only usage**: [`orc-mint-subsection-dashboard`](../../src/client/modules/mint/modules/mint-subsection-dashboard/components/mint-subsection-dashboard/mint-subsection-dashboard.component.html:24) at `/mint`, left tile of the second summary row (sibling of `orc-mint-general-activity`).
- Always mounted whenever the parent dashboard loads. The parent passes `mint_keysets` / `mint_keyset_counts` / `mint_database_info` from the route's resolvers ([mint-section.module.ts:127-131](../../src/client/modules/mint/modules/mint-section/mint-section.module.ts#L127)). No gating `@if` wraps the component itself.

## Inputs

| Input | Type | Required | Notes |
|---|---|---|---|
| `keysets` | `MintKeyset[]` | ✓ | From `mintKeysets` GraphQL via [`mintKeysetsResolver`](../../src/client/modules/mint/modules/mint-section/mint-section.module.ts#L47) → `MintService.loadMintKeysets()`. Each entry is a wrapped [`MintKeyset`](../../src/client/modules/mint/classes/mint-keyset.class.ts) carrying `id`, `active`, `unit`, `derivation_path_index`, `input_fee_ppk`, `valid_from`/`valid_to`, `fees_paid`, `amounts`. Only `active`, `unit`, `id` are read here. |
| `keysets_counts` | `MintKeysetCount[]` | ✓ | From `mintKeysetCounts({})` GraphQL via [`mintKeysetCountsResolver`](../../src/client/modules/mint/modules/mint-section/mint-section.module.ts#L60) → `MintService.loadMintKeysetCounts({})` (resolver passes empty args, so the server returns counts for *all* keysets). Each entry is a wrapped [`MintKeysetCount`](../../src/client/modules/mint/classes/mint-keyset-count.class.ts): `id`, `proof_count`, `promise_count`. Joined to `keysets` by `id`. |
| `database_info` | `MintDatabaseInfo \| null` | optional (default `null`) | From `mintDatabaseInfo` GraphQL via [`mintDatabaseInfoResolver`](../../src/client/modules/mint/modules/mint-section/mint-section.module.ts#L73) → `MintService.loadMintDatabaseInfo()`. The resolver swallows errors and emits `null` (other resolvers route to `/mint/error`); this card is the only consumer that tolerates the null. [`MintDatabaseInfo`](../../src/client/modules/mint/classes/mint-database-info.class.ts) carries `size: number` (bytes) and `type: string` (e.g. `'sqlite'` / `'postgres'`). |

## Outputs & projected content

- No `@Output()`s.
- No `<ng-content>` slots.

## Derived / computed signals

All seven computeds are pure functions over the three inputs.

- `active_count` → `number` — `keysets().filter(k => k.active).length`.
- `inactive_count` → `number` — `keysets().length - active_count()`. Computed by subtraction, not by counting `!k.active`, so a keyset with `active === undefined` (not currently produced by the resolver) would land in *inactive*.
- `active_percentage` → `number` (0–100) — `active_count / total * 100`, with a `total === 0` zero-division guard returning `0`. Drives the `[style.width.%]` of the top fill bar.
- `unique_units` → `MintUnit[]` — `[...new Set(keysets().map(k => k.unit))]`. Insertion-ordered (the daemon's keyset ordering wins). No client-side sort: SAT typically comes first because both cdk and nutshell provision the bitcoin keyset before optional fiat ones, but the component does not guarantee it.
- `active_keyset_ids` → `Set<string>` — fast lookup keyed by keyset id, used by `active_promises` / `active_proofs` to filter `keysets_counts` without an O(n²) scan.
- `total_promises` → `number` — `keysets_counts().reduce((s, kc) => s + kc.promise_count, 0)`.
- `total_proofs` → `number` — same shape over `proof_count`.
- `active_promises` → `number` — `keysets_counts().filter(kc => active_keyset_ids().has(kc.id)).reduce(... promise_count ...)`. **Counts where `keyset_counts` carries an id missing from `keysets()` are silently dropped** from `active_*` totals but still contribute to `total_*`. This is documented edge case 3 below.
- `active_proofs` → `number` — same shape over `proof_count`.
- `active_promises_percentage` → `number` (0–100) — `active_promises / total_promises * 100`, with a `total_promises === 0` zero-division guard returning `0`. Drives the `.keyset-bar-sm` fill on the Blind sigs card and the `{{ … | number: '1.0-0' }}% active keysets` label.
- `active_proofs_percentage` → `number` (0–100) — same shape over proofs.

## Happy path

1. Parent's resolvers (`mintKeysetsResolver`, `mintKeysetCountsResolver`, `mintDatabaseInfoResolver`) all settle; the dashboard mounts the card with three populated inputs.
2. Top row: `<active_count>` + `"active"` + `/` + `<inactive_count>` + `"inactive"`. The fill bar fills to `active_percentage()%`.
3. Below: one `mat-chip` per entry in `unique_units()`, displaying the unit `| uppercase`. The `Units` caption sits under the chip-set.
4. Below: two side-by-side stat cards. Each shows the locale-formatted total (`{{ total_* | number }}`) on the left, the `{{ active_*_percentage | number: '1.0-0' }}% active keysets` label on the right, and a 3-px-tall sub-bar filling to `active_*_percentage()%`.
5. Bottom: a single card with a `database` icon, the disk size via `dataBytes` pipe (e.g. `144 kB`, `8.47 MB`), and `{{ type | titlecase }} database size` ("Sqlite database size" / "Postgres database size").

## Reachable states

### 1. Single active keyset, no activity (regtest baseline)

Live state on every clean stack (`lnd-nutshell-sqlite`, `lnd-cdk-sqlite`, `cln-cdk-postgres`, `cln-nutshell-postgres`) — the daemons auto-provision exactly one `sat` keyset and no mint/melt has run yet.

- `1 active / 0 inactive`, fill bar 100%
- one chip: `SAT`
- Blind sigs `0`, `0% active keysets`, sub-bar 0%
- Proofs `0`, `0% active keysets`, sub-bar 0%
- `144 kB` (lnd-nutshell-sqlite live read) / `Sqlite database size`. Postgres stacks render the same shape with their `pg_database_size` reading and the title-cased `Postgres`.

### 2. Multiple units, all active, no activity

Reachable live only on stacks whose `mintd.toml` (cdk) or `compose.yml` (nutshell) opts into extra units — none of the four canonical e2e stacks does today. `fake-cdk-postgres` lists `supported_units = ["sat", "usd"]` in its mintd.toml. The user-facing reference screenshot is this state with three units.

- `3 active / 0 inactive`, fill bar 100%
- chips: `SAT`, `USD`, `EUR` in keyset-emission order
- Blind sigs / Proofs both `0`
- `8.48 MB Postgres database size`
- Captured live via signal override on `lnd-nutshell-sqlite` while authoring this spec.

### 3. Mixed active/inactive after rotation, with activity

Reached by rotating keysets a few times and minting/melting in between (`POST /v1/mint` etc. against the daemon).

- e.g. `2 active / 3 inactive`, fill bar 40% — top bar shows the active fraction across *all* keysets including retired ones
- chips reflect the surviving union (e.g. `SAT`, `USD` if both units rotated)
- Blind sigs `1,234,567` (locale-formatted via the `number` pipe), `53% active keysets` — i.e. 53% of all promises came from currently-active keysets, the remainder from rotated-out ones
- Proofs `987,654`, `56% active keysets`
- `Postgres database size` reflects the post-activity disk footprint

Captured live via signal override.

### 4. No keysets at all (`keysets() === []`)

Edge case — the daemon's database has zero rows. Both cdk and nutshell auto-provision a sat keyset on first launch, so this is unreachable from a healthy daemon. Reachable from the *resolver's* error branch only via signal override.

- Top reads `0 active / 0 inactive`, fill bar at 0% (zero-division guard)
- chip-set is empty; the `Units` caption still renders below an empty chip row
- Blind sigs `0` / `0% active keysets`, Proofs `0` / `0% active keysets`
- Database card still renders with whatever `database_info()` reports — the empty-keysets branch does not affect the database row

### 5. `database_info` is `null`

Reachable when the `mintDatabaseInfoResolver` catches an error from `loadMintDatabaseInfo()` and emits `null` ([mint-section.module.ts:73](../../src/client/modules/mint/modules/mint-section/mint-section.module.ts#L73)).

- The card still renders its database row.
- `dataBytes` pipe transforms `null` → `'0 B'` ([data-bytes.pipe.ts:11](../../src/client/modules/data/pipes/data-bytes/data-bytes.pipe.ts#L11)).
- `titlecase` pipe transforms `undefined` → empty string, so the sublabel reads **" database size"** with a leading space — a minor cosmetic quirk, not a layout break.

Captured live via signal override.

### 6. `keyset_counts` has ids missing from `keysets`

E.g. the daemon DB still carries proof/promise counts for a fully-pruned keyset that the `mint_keysets` query has dropped. `active_keyset_ids()` will not contain those ids; the orphan rows contribute to `total_*` but not to `active_*`. Visible as a `total_* > 0` with `active_*_percentage < 100` even when *every* keyset in `keysets()` is `active === true`. Documented but not currently produced by the daemons; reachable only via synthetic data.

### 7. Database type other than `sqlite` / `postgres`

`type` is a free `string` on the GraphQL schema, and the template runs it through `titlecase`. Any new engine string the resolver emits (`'mariadb'`, `'memory'`, etc.) renders directly with no whitelist. No styling change. Documented edge case rather than a failure mode.

## Child components

The card delegates to three Material components and two pipes — none of which render any non-trivial state machine of their own from this parent's bindings.

### `mat-chip-set` + `mat-chip`

- `mat-chip-set` wraps the `@for (unit of unique_units(); track unit)` loop. Each `mat-chip` renders the unit string `| uppercase` as its content; no avatar, no remove button, no `(removed)` handler.
- The chips are presentational. Unlike the bitcoin info card's URI chips, they have no `(click)` binding and open no dialog. Hover ripple is the default Material chip ripple — visual only.

### `mat-icon` (database glyph)

- Single `mat-icon` in the database row with the literal text `database`. Resolves via the Material Symbols ligature font — no custom `svgIcon`. Tinted via the `orc-outline-color` class.

### Pipes

- `uppercase` — chip text. Trivial.
- `dataBytes` ([data-bytes.pipe.ts](../../src/client/modules/data/pipes/data-bytes/data-bytes.pipe.ts)) — formats bytes to one of `B / kB / MB / GB / TB`, picking the unit by `Math.floor(log_1024(bytes))` and rendering the value via `parseFloat(toFixed(2))` (so `1024 → "1 kB"`, `1536 → "1.5 kB"`, `8_888_320 → "8.48 MB"`). `0 / null / undefined` short-circuit to `"0 B"`.
- `titlecase` — Angular's built-in. Capitalises the first letter of each whitespace-delimited token. `undefined → ""`.
- `number: '1.0-0'` — Angular's built-in `DecimalPipe`. Locale-formatted integer, no fractional digits. The bare `number` (used on `total_promises` / `total_proofs`) defaults to `1.0-3` minimum/max — but since both totals are always integers, the rendered output is locale-formatted with thousands separators only.

## Unhappy / edge cases

- **`keysets()` empty + `keysets_counts()` non-empty** — `total_*` populated, `active_*` zero (no ids match an empty active set), `active_*_percentage` zero. Visible as totals with 0% active.
- **`active_percentage` > 100** — impossible by construction (`active_count <= total`); not guarded against because not reachable.
- **`keysets_counts` includes a duplicate id** — `total_*` would double-count; `active_*` would also double-count if the id matches an active keyset. Not currently produced by the resolver but no client-side dedupe.
- **`unique_units()` empty (no keysets)** — the chip-set renders empty, the `Units` caption renders alone. No "no units" fallback text.
- **Negative `database_info.size`** — the `dataBytes` pipe takes `Math.log(negative)` which yields `NaN`, and `Math.floor(NaN) = NaN`, so `units[NaN]` is `undefined` and the rendered string is `"NaN undefined"`. Defensive only; the daemon never emits negative sizes.
- **Very large counts** — the `number` pipe handles JS numbers up to `Number.MAX_SAFE_INTEGER` (≈ 9 × 10^15) without overflow. The card layout doesn't truncate; the `font-size-l` total wraps under the percentage label if it exceeds the half-card width.
- **Postgres size jitter** — `pg_database_size` is approximate and includes index/WAL overhead. Re-renders may shift the value by KB-scale even with no UI-visible activity. Visible as a value that wobbles between two readings; not a UI bug.

## Template structure (at a glance)

```
.flex-column
├── "Keysets" title (.title-l)
└── mat-card
    └── mat-card-content (.orc-surface-container-low-bg)
        ├── active/inactive summary
        │   ├── "<active_count> active / <inactive_count> inactive"
        │   └── .keyset-bar  (lg)
        │       └── .keyset-bar-fill  [width.%]=active_percentage()
        ├── units block
        │   ├── mat-chip-set
        │   │   └── @for (unit of unique_units()) → mat-chip { unit | uppercase }
        │   └── caption: "Units"
        ├── blind-sigs + proofs row
        │   ├── .orc-high-card  (Blind sigs)
        │   │   ├── total_promises | number
        │   │   ├── "<active_promises_percentage>% active keysets"
        │   │   └── .keyset-bar.keyset-bar-sm > .keyset-bar-fill [width.%]=active_promises_percentage()
        │   └── .orc-high-card  (Proofs)
        │       └── …same shape over total_proofs / active_proofs_percentage
        └── .orc-high-card  (database)
            ├── mat-icon "database"
            ├── database_info()?.size | dataBytes
            └── (database_info()?.type | titlecase) + " database size"
```

## Interaction summary

| Gesture | Target | Result |
|---|---|---|
| (none) | — | The component is read-only — no clicks, hovers with side effects, drags, or form inputs. Chip ripples and Material focus rings are visual only. |

## Test-author handoff

### Host page + setup

- Route: `goto('/mint')`. Authenticated; storageState if available, otherwise `loginViaUi`.
- `beforeEach` shape: navigate to `/mint`, wait for the dashboard to settle (the sibling `orc-mint-general-info` card is the cheapest "page settled" probe shared across mint specs), then scope into `page.locator('orc-mint-general-keysets')`.
- Tag: `@mint` for the structure that holds on every stack — title, mat-card mount, active/inactive count + bar, unit chip-set against `mintUnitsFor(config)`, database row's titlecase engine label. **Blind sigs and Proofs assertions are analytics-sensitive and must carry `@analytics`** — the rendered totals come from the `mintKeysetCounts` GraphQL resolver, which reads from the analytics archive (the same backfill stream the dashboard's "Archiving…" progress tracks). On a freshly-spun stack `total_*` start at `0` and grow only as backfill processes mint/melt/swap rows; asserting against the daemon DB without gating on `last_processed_at` will race the archive. Split tests so the `@mint`-only assertions don't pay the analytics-readiness cost. Not part of `@canary`.

### Differential oracles

| Input | Backend helper | Notes |
|---|---|---|
| `keysets[].active` / `unit` / `id` | [`mint.keysets(config)`](../../e2e/helpers/backend/mint.ts) | Existing helper. Already returns `{id, unit, active, derivation_path_index, input_fee_ppk}` for both cdk + nutshell. The card reads only `active`/`unit`/`id`, so the helper is sufficient as-is. |
| `keysets_counts[].promise_count` / `proof_count` | [`mint.keysetCountsOracle(config, {last_processed_at})`](../../e2e/helpers/backend/mint.ts) | Counts daemon-DB rows whose `created_time < last_processed_at + 3600` — i.e. lifetime up through the most recent COMPLETED analytics hour. cdk: `blind_signature.created_time` / `proof.created_time` (epoch seconds INTEGER on both sqlite + postgres). nutshell: `promises.created` / `proofs_used.created` (INTEGER on sqlite, TIMESTAMP on postgres — uses `EXTRACT(EPOCH FROM …)` like `activitySummaryOracle`). **Tests using this oracle are `@analytics`** (see *Host page + setup*) — UI totals come through the archive, so the comparison only holds within the cache's coverage window. |
| `database_info.type` | derive from `config.db` | The resolver only emits `'sqlite'` or `'postgres'`. The titlecase-engine label assertion derives the expected string as `config.db[0].toUpperCase() + config.db.slice(1) + ' database size'`. No daemon read needed. |
| `database_info.size` | n/a | Not asserted differentially. Sqlite is byte-stable but postgres jitter (autovacuum / WAL) shifts `pg_database_size` by KB without writes; the rendered value is asserted shape-only — must format as a positive `<n[.dd]> <unit>` via the `dataBytes` pipe. Cover any pipe-formatting edge cases (`0 B` for null/0) in Karma instead. |
| `MintUnit` set per stack | [`mintUnitsFor(config)`](../../e2e/helpers/config.ts#L269) | Existing. Use to assert chip-count and chip-text matches the stack's configured units. |

### State reachability matrix

| State | `lnd-nutshell-sqlite` | `lnd-cdk-sqlite` | `cln-cdk-postgres` | `cln-nutshell-postgres` |
|---|---|---|---|---|
| 1. Single sat keyset, no activity | ✓ live | ✓ live | ✓ live | ✓ live |
| 2. Multiple units, all active | — fixture-only | — fixture-only | — fixture-only | — fixture-only |
| 3. Mixed active/inactive after rotation + activity | — disruptive | — disruptive | — disruptive | — disruptive |
| 4. No keysets (empty) | — synthetic | — synthetic | — synthetic | — synthetic |
| 5. `database_info` null | — disruptive | — disruptive | — disruptive | — disruptive |
| 6. Orphan ids in `keysets_counts` | — synthetic | — synthetic | — synthetic | — synthetic |
| 7. Unrecognised `database_info.type` | — synthetic | — synthetic | — synthetic | — synthetic |

State 2 becomes ✓ live on `fake-cdk-postgres` (`supported_units = ["sat", "usd"]` in mintd.toml) — currently outside the e2e mint matrix; gate via `testInfo.project.name` if that stack joins the matrix.

State 3 is in principle live-reachable on every stack via a `cdk-cli rotate-keysets` (or nutshell equivalent) plus a few mint/melt cycles, but reordering keyset rotation into the e2e flow would mutate downstream specs that assume a single active keyset — tagged `disruptive`, treat as a dedicated `*-rotation` spec rather than retrofitting here.

### Per-state probes

The card root locator is `card = page.locator('orc-mint-general-keysets')`. Every probe scopes within `card`.

| State | Settled signal | Primary assert |
|---|---|---|
| Card mount | `card.locator('mat-card')` visible | `await expect(card).toBeVisible()` |
| Title | `card.getByText('Keysets', {exact: true})` | exactly one |
| 1. Single sat live | `card.locator('mat-chip').first()` visible with text `SAT` | `card.locator('mat-chip')` count = `mintUnitsFor(config).length`; `getByText('1 active')` and `getByText('0 inactive')` visible (or counts derived from `mint.keysets(config)`); database row contains `mintUnitsFor(config).length === 1 ? '0 B' : whatever-the-helper-returns` (substitute when the database helper lands) |
| 2. Multiple units | `card.locator('mat-chip')` count > 1 | every unit returned by `mintUnitsFor(config)` has a matching `mat-chip` whose `textContent.trim().toLowerCase() === unit` |
| 3. Active/inactive mix | `getByText(/^\d+\s*active/)` visible | `card.locator('.keyset-bar:not(.keyset-bar-sm) .keyset-bar-fill')`'s inline `style.width` matches `active / total * 100`% within ±1% |
| 4. Empty keysets | `getByText('0 active')` visible | `card.locator('mat-chip')` count = 0 |
| 5. database_info null | `card.locator('mat-icon', {hasText: 'database'})` visible | `card.locator('.orc-high-card').last()` contains `'0 B'` AND text `' database size'` (note leading space — quirk) |
| 6. Orphan ids in counts | n/a — synthetic only | computed math; covered in Karma |
| 7. Unrecognised db type | n/a — synthetic only | computed math; covered in Karma |

Locator probe verification (run on live `lnd-nutshell-sqlite` while authoring this spec, all returned exactly the expected count):

```js
document.querySelectorAll('orc-mint-general-keysets').length                       // 1
document.querySelectorAll('orc-mint-general-keysets mat-card').length              // 1
Array.from(document.querySelectorAll('orc-mint-general-keysets .title-l'))
  .filter(e => e.textContent.trim() === 'Keysets').length                          // 1
document.querySelectorAll('orc-mint-general-keysets mat-chip-set').length          // 1
document.querySelectorAll('orc-mint-general-keysets mat-chip').length              // 1  (sat-only stack)
document.querySelectorAll('orc-mint-general-keysets .orc-high-card').length        // 3  (Blind sigs / Proofs / database)
document.querySelectorAll('orc-mint-general-keysets .keyset-bar').length           // 3  (1 lg + 2 sm)
document.querySelectorAll('orc-mint-general-keysets .keyset-bar-sm').length        // 2
document.querySelectorAll('orc-mint-general-keysets mat-icon').length              // 1  (database)
```

### Reusable interaction recipes

- **None of the click/hover/dialog recipes apply.** The card is read-only.
- **Width assertion via inline style** — the fill bars expose `[style.width.%]`. Read with `await bar.getAttribute('style')` and parse the `width: 40%` token rather than rounding `getComputedStyle().width` (CSS sub-pixel rounding shifts the value by 0.5px; the percent token is exact).
- **`number` pipe locale awareness** — Playwright's locale defaults to `en-US`, so the rendered separators are commas. If the project ever pins a different locale, switch the assertion to a `\d{1,3}(?:,\d{3})*` regex and read the integer back via `replace(/[^\d]/g, '')`. Match the `amountFromText` helper in [mint-general-balance-sheet.spec.ts](../../e2e/specs/mint-general-balance-sheet.spec.ts).
- **`titlecase` of the engine** — `'sqlite' | 'postgres'` ⇒ `'Sqlite' | 'Postgres'`. Don't hardcode; derive via `config.db[0].toUpperCase() + config.db.slice(1)` to stay aligned with the helper.

### Skip taxonomy

| Uncovered state | Tag | Rationale |
|---|---|---|
| 2. Multiple units (sat + usd / eur) | `stack-only` | Reachable on `fake-cdk-postgres` only (`supported_units = ["sat", "usd"]` in mintd.toml). The fake stack isn't in today's mint matrix; gate via `testInfo.project.name` if/when added. |
| 3. Mixed active/inactive after rotation | `disruptive` | Rotating keysets mid-suite would mutate downstream specs that assume a single active keyset. Better as a dedicated `*-rotation` spec or a recorded fixture. |
| 4. Empty keysets | `dead-branch` | Both cdk and nutshell auto-provision a sat keyset on first launch; the daemon never emits zero rows. Defensive `total === 0` guard is covered by the existing Karma spec. |
| 5. `database_info` null | `disruptive` | Triggering the resolver's `null` branch requires either pausing the database container or breaking `loadMintDatabaseInfo()` via fixture — both knock out sibling specs. |
| 6. Orphan ids in `keyset_counts` | `dead-branch` | Daemons emit count rows only for keysets that exist in `keysets`. Pure-data invariant; covered as a Karma assertion against the `active_promises` computed. |
| 7. Unknown `database_info.type` | `dead-branch` | Today the resolver only emits `'sqlite'` or `'postgres'`. Pipe behaviour over arbitrary strings is covered by `titlecase`'s own tests. |

## Test fidelity hooks

No `mint-general-keysets.spec.ts` exists yet — this spec is being authored to support writing it. The component-level Karma spec [mint-general-keysets.component.spec.ts](../../src/client/modules/mint/modules/mint-general/components/mint-general-keysets/mint-general-keysets.component.spec.ts) already covers all seven computed signals (zero-division guards, active_promises filtering by id, percentage math).

States the upcoming `mint-general-keysets.spec.ts` should cover (live-reachable on the fixture matrix):

- **Card mounts on `/mint`** — `mat-card` count = 1, with the "Keysets" title.
- **Active/inactive counts match the daemon truth** — read via `mint.keysets(config)`, count `k.active === true` vs `false`. Assert the rendered numbers and the bar's `[style.width.%]` to within ±1%. Differential.
- **Chip set matches `mintUnitsFor(config)`** — for each unit the helper returns, exactly one chip whose text equals `unit.toUpperCase()` exists. Differential.
- **Database type matches the stack** — assert the database row's sublabel contains `config.db[0].toUpperCase() + config.db.slice(1) + ' database size'`. Differential against `config.db`.
- **Database size renders as a positive byte string** — assert the rendered text matches `^\d+(?:\.\d+)?\s*(?:B|kB|MB|GB|TB)$` and the leading numeric is `> 0`. Shape-only; no oracle, no exact-bytes comparison.
- **Blind sigs total equals daemon promise count up through the latest archived hour** *(`@analytics`)* — gate via `requireReady(page, mintAnalyticsHasRows)`, derive the cache ceiling via `latestMintCacheHour(readiness)`, then assert `amountFromText(blindSigsTile)` equals `mint.keysetCountsOracle(config, {last_processed_at}).total_promises`.
- **Proofs total equals daemon proof count up through the latest archived hour** *(`@analytics`)* — mirror over `total_proofs`. Both differentials hold exactly once backfill has rolled the latest hour bucket; the ceiling at `last_processed_at + 3600` is what makes the equality robust to in-flight rows that haven't been bucketed yet.

States explicitly **not** to cover in the e2e (see *Skip taxonomy* for tags):

- All synthetic-only branches (zero-division, orphan ids, unknown engine) — covered in Karma.
- Rotation/mixed-active states — would need a dedicated rotation spec or fixture.
- `database_info === null` — would need to break the resolver under test, knocks out sibling specs.

## Notes for implementers

- `OnPush` + signal inputs — re-renders on any new array reference. The resolvers wrap `MintKeyset` / `MintKeysetCount` / `MintDatabaseInfo` instances on each navigation, so the card always re-renders cleanly on route entry.
- All seven computeds trace back to the three signal inputs only; a single signal write at the parent cascades atomically. No risk of the chip block disagreeing with the count cards mid-frame.
- `active_keyset_ids` is a `Set` rebuilt on every keyset change. Cheap for the regtest scale (one to a few dozen keysets); if a deployment ever hits thousands of keysets, consider memoising the join between `keysets_counts` and the active set rather than rebuilding the `Set` every render.
- The `dataBytes` pipe is `pure`, so it only re-runs when `size` changes by reference. Postgres's `pg_database_size` jitter will trigger frequent re-renders if the resolver re-polls — currently the resolver is called once per route entry, so this is a non-issue.
- `keyset-bar-fill` animates via `transition: width 0.3s ease`. Visual tests need to wait one frame after data swap for the bar to settle before snapshotting.
- The component has no `ngOnInit`, no subscriptions, no `ngOnDestroy` — appropriate. Don't introduce lifecycle hooks unless the data contract changes.
- The "0 inactive" / "1 inactive" line is grammatically inconsistent — the rendered string is always `<n> inactive` with no plural agreement. Match the convention if extending; do not introduce conditional pluralisation just for grammar.
