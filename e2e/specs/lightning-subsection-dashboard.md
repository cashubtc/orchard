# `orc-lightning-subsection-dashboard`

Source: [lightning-subsection-dashboard.component.ts](../../src/client/modules/lightning/modules/lightning-subsection-dashboard/components/lightning-subsection-dashboard/lightning-subsection-dashboard.component.ts) · [`.html`](../../src/client/modules/lightning/modules/lightning-subsection-dashboard/components/lightning-subsection-dashboard/lightning-subsection-dashboard.component.html)

## Purpose

The routed body of `/lightning`. Today it is a **placeholder stub**: a bolt icon and the static string "Lightning Dashboard Coming Soon!". No inputs, no outputs, no service calls, no signals — the component class is empty. The testable surface of `/lightning` is therefore mostly its host wrapper `orc-lightning-section`, which owns the secondary-nav chrome (node alias + colour dot, "Dashboard" nav item, node version, more-menu) and fetches `lightning_info` via `LightningService.loadLightningInfo()`.

## Where it renders

- **Only usage**: lazy-loaded child route `''` of [`lightning-section.module.ts`](../../src/client/modules/lightning/modules/lightning-section/lightning-section.module.ts) — mounted into `orc-lightning-section`'s `<router-outlet>` when the URL is exactly `/lightning`.
- Gated by [`enabledGuard`](../../src/client/modules/routing/guards/enabled/enabled.guard.ts): when `config.lightning.enabled` is false the router redirects to `/lightning/disabled` and this component never mounts. On the shipped stacks that redirect happens only on `fake-cdk-postgres`.

## Inputs

| Input | Type | Required | Notes |
|---|---|---|---|
| — | — | — | The stub takes no inputs. The section wrapper (documented below) has no inputs either; it feeds itself from `LightningService.lightning_info$`. |

## Outputs & projected content

- No `@Output()`s, no `<ng-content>` slots in either the stub or the section wrapper (the wrapper projects *into* `orc-nav-secondary`'s named slots: `nav-secondary-header`, `nav-secondary-items`, `nav-secondary-toolbar`).

## Derived / computed signals

The stub has none. On the wrapper (`orc-lightning-section`, [lightning-section.component.ts](../../src/client/modules/lightning/modules/lightning-section/components/lightning-section/lightning-section.component.ts)):

- `active_sub_section: WritableSignal<string>` — set from router events ([lightning-section.component.ts:58-73](../../src/client/modules/lightning/modules/lightning-section/components/lightning-section/lightning-section.component.ts#L58)). On `/lightning` it resolves `'dashboard'` (route data `sub_section: 'dashboard'`), which drives `[active]` on the single `orc-nav-secondary-item`.
- `lightning_info: LightningInfo | null` — plain property (not a signal), populated by `lightning_info$` subscription + manual `cdr.detectChanges()`. Null until the `lightning_info` GraphQL query resolves; template reads are all optional-chained.
- `loading` / `error` booleans exist on the class but are **never referenced by the template** — an error from `loadLightningInfo()` leaves the header permanently blank rather than rendering an error surface.

## Happy path

1. User navigates to `/lightning` (from the primary nav or directly). `enabledGuard` passes on every stack with `LIGHTNING_TYPE` set.
2. `orc-lightning-section` mounts, kicks off `loadLightningInfo()`, and renders the secondary nav immediately: header alias/dot empty until the query resolves (sub-second on a local stack).
3. Info arrives: header shows a round dot coloured `lightning_info.color` (lnd default `#3399ff`), the node alias (`orchard` on the e2e stacks), and the toolbar shows the LN implementation version string (`0.20.0-beta commit=v0.20.0-beta` on lnd 0.20; `v2x.xx` style on cln).
4. The single "Dashboard" nav item renders highlighted (`active_sub_section() === 'dashboard'`).
5. The routed body renders the stub: `mat-icon` `bolt` + "Lightning Dashboard Coming Soon!".

## Reachable states

### 1. Stub populated (the only body state)

Always rendered when the route mounts. `.lightning-dashboard-container` contains exactly one `mat-icon` (ligature `bolt`) and the static text. No variation by stack, device, or data.

### 2. Header populated

`lightning_info` non-null. Dot's inline `background-color` equals `lightning_info.color`; alias text equals `lightning_info.alias`; `.section-implementation` equals `lightning_info.version`. Values differ per LN impl (lnd vs cln alias/version/color of the stack's orchard-side node) — assert differentially via `ln.getInfo`.

### 3. Header blank (info not yet loaded / query error)

`lightning_info === null`. Alias and version render as empty strings; the dot div is still in the DOM with `background-color` unset (transparent). Live only for the sub-second pre-resolve window; deterministic reproduction requires signal override (`cmp.lightning_info = null; ng.applyChanges`) or a paused backend. The error branch renders identically because the template never branches on `error`.

### 4. More-menu open

Clicking the `more_vert` icon button in the toolbar opens a `mat-menu` (CDK overlay) with a single **Logout** item. See child section.

### 5. Disabled redirect (`/lightning` → `/lightning/disabled`)

`config.lightning.enabled === false` (Orchard booted without `LIGHTNING_TYPE`). The stub never mounts; `orc-lightning-subsection-disabled` renders instead (sample `.env` explainer). Stack-only: `fake-cdk-postgres`. Covered by the disabled-subsections spec, not this one.

## Child components

### `orc-nav-secondary-item` ("Dashboard" tab)

- Source: [nav-secondary-item.component.ts](../../src/client/modules/nav/components/nav-secondary-item/nav-secondary-item.component.ts) · [`.html`](../../src/client/modules/nav/components/nav-secondary-item/nav-secondary-item.component.html)
- Inputs from this parent: `name="Dashboard"`, `navroute="mint"`, `[active]="active_sub_section() === 'dashboard'"`.
- `highlight = computed(() => active() || moused())` — the underline/highlight shows when active **or** hovered.
- Interactions: hover toggles `moused`; click calls `router.navigate([navroute()])`.
- **KNOWN BUG**: `navroute` is `"mint"` in [lightning-section.component.html:10](../../src/client/modules/lightning/modules/lightning-section/components/lightning-section/lightning-section.component.html#L10) — clicking "Dashboard" while on `/lightning` navigates to `/mint`. Do not assert the current (broken) destination; the click interaction is skipped until the fix lands (tracked as a separate fix task).

### `orc-nav-secondary-more` (toolbar more-menu)

- Source: [nav-secondary-more.component.ts](../../src/client/modules/nav/components/nav-secondary-more/nav-secondary-more.component.ts) · [`.html`](../../src/client/modules/nav/components/nav-secondary-more/nav-secondary-more.component.html)
- No inputs. One `mat-icon-button` (`more_vert`) with `matMenuTriggerFor`.
- Menu content: single item — icon `logout` + text "Logout". `logout()` revokes the token (`authService.revokeToken()`), clears the crew cache, navigates to `/auth`.
- States: closed (default) / open (CDK overlay `.mat-mdc-menu-panel.orc-more-menu` with one `.mat-mdc-menu-item`).
- Closes on Escape or backdrop click with no side effect. Clicking Logout is **disruptive** for a shared storageState session (revokes the token every sibling spec relies on) — exercise it only in an auth-focused spec with an isolated context.

### `orc-nav-secondary` (layout shell)

- Source: [nav-secondary.component.ts](../../src/client/modules/nav/components/nav-secondary/nav-secondary.component.ts) — pure slot layout (`nav-secondary-header` / `-items` / `-toolbar`), no logic worth asserting beyond presence.

## Unhappy / edge cases

- `loadLightningInfo()` error: `error = true` is set but nothing in the template consumes it — the page renders the stub body under a blank header. No retry surface. (State 3.)
- `lightning_info.color` arrives as whatever string the LN node reports; it is bound raw to `style.background-color`. A malformed colour string renders a transparent dot — no sanitisation beyond Angular's style sanitizer.
- `getSubSection` on a `NavigationStart` whose URL doesn't begin with `/lightning` returns the previous value — the tab highlight doesn't flicker during cross-section navigation.
- The version div renders the raw `version` string untruncated; a long string (cln's can be verbose) simply widens the toolbar (`text-nowrap` is only on the alias).

## Template structure (at a glance)

```
orc-lightning-section
└─ section.section-container
   ├─ orc-nav-secondary
   │  ├─ [nav-secondary-header]  div.flex → dot(.h-2.w-2, bg=info.color) + alias(.text-nowrap)
   │  ├─ [nav-secondary-items]   orc-nav-secondary-item ("Dashboard", active on /lightning)
   │  └─ [nav-secondary-toolbar] .section-implementation (info.version) + orc-nav-secondary-more (more_vert → mat-menu: Logout)
   └─ div.subsection-container
      └─ router-outlet → orc-lightning-subsection-dashboard
         └─ div.lightning-dashboard-container.p-1
            ├─ mat-icon.icon-lg "bolt"
            └─ div "Lightning Dashboard Coming Soon!"
```

## Interaction summary

| Gesture | Target | Result |
|---|---|---|
| Hover | `orc-nav-secondary-item` container | Highlight underline animates in (`moused` signal) |
| Click | `orc-nav-secondary-item` ("Dashboard") | `router.navigate(['mint'])` — **bug**, lands on `/mint`; do not assert |
| Click | `orc-nav-secondary-more button` | Opens mat-menu overlay with Logout |
| Click | Logout menu item | Revokes token, clears crew cache, navigates `/auth` — disruptive |
| Escape / backdrop click | open mat-menu | Closes menu, no side effect |

## Test-author handoff

### Host page + setup

- Route: `page.goto('/lightning')`. Auth via the project's storageState (baked by `setup-<config>`); no extra waits needed beyond the header assertion itself — the stub renders synchronously and `lightning_info` resolves sub-second.
- Tag: `@lightning` for everything header/stub (needs a real LN backend; runs on all four LN stacks). The disabled redirect belongs to the disabled-subsections spec (`@no-lightning`).

### Differential oracles

| Surface | Oracle |
|---|---|
| Header alias | `ln.getInfo(config).alias` ([backend/lightning.ts](../helpers/backend/lightning.ts)) — lnd and cln both emit `alias` |
| Dot colour | `ln.getInfo(config).color` — lnd emits `#rrggbb` and renders correctly. **KNOWN BUG (cln)**: `mapClnInfo`'s `toHex` ([cln.service.ts:106-114](../../src/server/modules/lightning/cln/cln.service.ts#L106)) strips `#`, so the client binds an invalid CSS colour and the dot renders transparent on cln stacks. Assert the colour differentially on lnd only; on cln assert nothing until the normalization fix lands (tracked as a separate fix task). |
| Version string | `ln.getInfo(config).version` |
| Stub text/icon | Static — no oracle needed |
| Nav item active | Static expectation on `/lightning` |

### State reachability matrix

| State | lnd-nutshell-sqlite | lnd-cdk-sqlite | cln-cdk-postgres | cln-nutshell-postgres | fake-cdk-postgres |
|---|---|---|---|---|---|
| 1. Stub populated | ✓ live | ✓ live | ✓ live | ✓ live | — (redirects to /disabled) |
| 2. Header populated | ✓ live | ✓ live | ✓ live | ✓ live | — |
| 3. Header blank | — synthetic | — synthetic | — synthetic | — synthetic | — |
| 4. More-menu open | ✓ live | ✓ live | ✓ live | ✓ live | — |
| 5. Disabled redirect | — | — | — | — | ✓ live (other spec) |

### Per-state probes

| State | Settled signal | Primary assert |
|---|---|---|
| 1. Stub | `orc-lightning-subsection-dashboard .lightning-dashboard-container` visible | `getByText('Lightning Dashboard Coming Soon!')` visible; exactly one `mat-icon` with text `bolt` |
| 2. Header | `orc-lightning-section .nav-secondary-header .text-nowrap` non-empty | alias text equals oracle; `.section-implementation` equals oracle version; dot `.h-2.w-2` inline background-color equals oracle colour |
| 3. Header blank | n/a (synthetic) | not e2e-tested — see skip taxonomy |
| 4. More-menu | `.cdk-overlay-container .mat-mdc-menu-item` visible | menu has exactly one item with text `Logout`; Escape closes it (`.mat-mdc-menu-panel` count → 0) |
| 5. Disabled redirect | `orc-lightning-subsection-disabled` visible | `expect(page).toHaveURL(/\/lightning\/disabled$/)` — asserted in the disabled-subsections spec |

All locators verified unique on a live `lnd-nutshell-sqlite` preview (`querySelectorAll(...).length === 1`).

### Reusable interaction recipes

- Material menu open: `page.locator('orc-lightning-section orc-nav-secondary-more button').click()` works in Playwright (real events) even though `preview_click` needed an eval fallback; close via `page.keyboard.press('Escape')`. Same pattern as the mint dashboard control's menus in [mint-subsection-dashboard.spec.ts](mint-subsection-dashboard.spec.ts).
- Inline style colour read: assert on `getAttribute('style')` containing the oracle colour (or `evaluate(getComputedStyle)`) — mirror `readWidthPercent` in [mint-general-keysets.spec.ts](mint-general-keysets.spec.ts) which reads inline bindings in preference to computed px.

### Skip taxonomy

- State 3 (header blank): `unit-better` — a sub-second transient; deterministic only via signal override, which Playwright can't do against a prod bundle. The null-safety is trivially covered by optional chaining.
- Nav item click destination: `known-bug` (`navroute="mint"`) — skipped until the fix lands; then assert it stays on `/lightning`.
- Logout menu item click: `disruptive` — revokes the shared storageState token. Menu open/close is covered; the actual logout flow belongs to the auth spec with an isolated browser context.
- State 5 (disabled redirect): `stack-only` — covered by the disabled-subsections spec on `fake-cdk-postgres`.

## Test fidelity hooks

- No existing `lightning-subsection-dashboard.spec.ts` — this file is the first coverage of `/lightning` as a page. The sibling cards (`orc-lightning-general-info`, `orc-lightning-general-channel-summary`) are covered on `/` by their own specs and do not render here.
- Covered by the planned spec: states 1, 2, 4 (+ menu close).
- Not covered: state 3 (`unit-better`), state 5 (`stack-only`, other spec), logout click (`disruptive`), nav-item click (`known-bug`).

## Notes for implementers

- The section wrapper is pre-signals legacy: `lightning_info` is a plain property + manual `detectChanges()` under OnPush. If it migrates to signals, the header locators here stay valid but the "blank" state's reproduction recipe (`cmp.lightning_info = null`) changes.
- `loading`/`error` are dead template state today — if an error surface is added to the wrapper, state 3 splits into distinct loading vs error states and this spec needs a revision.
- When the real Lightning dashboard replaces the stub, this spec's body section is obsolete wholesale — expect the header/chrome sections to survive.
