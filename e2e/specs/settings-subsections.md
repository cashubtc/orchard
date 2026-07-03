# `orc-settings-subsection-device` / `-app` / `-user`

Source:
- Device: [settings-subsection-device.component.ts](../../src/client/modules/settings/modules/settings-subsection-device/components/settings-subsection-device/settings-subsection-device.component.ts) · [`.html`](../../src/client/modules/settings/modules/settings-subsection-device/components/settings-subsection-device/settings-subsection-device.component.html)
- App: [settings-subsection-app.component.ts](../../src/client/modules/settings/modules/settings-subsection-app/components/settings-subsection-app/settings-subsection-app.component.ts) · [`.html`](../../src/client/modules/settings/modules/settings-subsection-app/components/settings-subsection-app/settings-subsection-app.component.html)
- User: [settings-subsection-user.component.ts](../../src/client/modules/settings/modules/settings-subsection-user/components/settings-subsection-user/settings-subsection-user.component.ts) · [`.html`](../../src/client/modules/settings/modules/settings-subsection-user/components/settings-subsection-user/settings-subsection-user.component.html)

## Purpose

The three `/settings/*` pages. **Device** (`/settings/device`) holds localStorage-persisted display prefs: timezone, locale, theme, BTC/fiat currency format, AI model. **App** (`/settings/app`) holds server-persisted operator settings: the Bitcoin price oracle toggle and the AI integration config. **User** (`/settings/user`) holds the current operator's account: name, password change, messaging prefs. `/settings` redirects to `/settings/app`.

These pages are already exercised as a mutation flow by `setup/settings.setup.ts` (which drives each control per the stack's settings matrix and bakes the result into storageState). This spec is therefore **read-only**: it asserts page structure and that persisted settings match the matrix — it never re-drives the controls, so it does not clobber the baked storageState the whole suite depends on.

## Where it renders

Lazy children of [`settings-section.module.ts`](../../src/client/modules/settings/modules/settings-section/settings-section.module.ts), no enable guard (auth only). Titles: `Orchard | App Settings` / `Device Settings` / `User Settings`.

## Derived / computed signals

- Device `device_type` — below desktop, a "Settings" menu button replaces the inline section nav.
- Device `theme()` / `locale()` / `timezone()` / `currency_*()` — read from `SettingDeviceService` (localStorage). `setTheme()` applies the theme as a class on `document.body` (`dark-mode` / `light-mode`), removing the other.

## Happy path

1. Navigate to `/settings/device`. Sections render: Location (timezone + locale), Theme, Currency (BTC + fiat), AI.
2. The persisted theme is reflected as a body class; the persisted timezone/locale drive date/number rendering app-wide.
3. `/settings/app`: Bitcoin (oracle toggle) + AI (integration) sections.
4. `/settings/user`: User (name + password) + messaging sections.

## Reachable states

### 1. Device page structure

Four sections (Location, Theme, Currency, AI) with cards: `-timezone`, `-locale`, `-theme`, two `-currency` (BTC + fiat), `-ai`. Observed live on canary.

### 2. Theme applied (differential)

`document.body` carries `dark-mode` or `light-mode`. On a stack whose settings matrix set `theme`, the class equals `config.deviceSettings.theme`. Canary (no matrix) → system default.

### 3. App page structure

Bitcoin section (oracle toggle, `orc-settings-subsection-app-bitcoin` → `-bitcoin-oracle`) + AI section (`-ai` → integration/agent/job/messaging children).

### 4. App bitcoin-oracle state (differential)

The oracle toggle reflects `config.appSettings.bitcoin_oracle` (on for `cln-nutshell-postgres`, default-off elsewhere).

### 5. User page structure

User section (`-user` → `-user-name`, `-user-password` → `-user-password-dialog`) + messaging section.

### 6. Mobile Settings menu

Below desktop, a `menu`-triggered mat-menu of section jump targets replaces the inline nav.

### 7. AI-enabled surfaces

On `ai_enabled` stacks (`cln-cdk-postgres`), the app AI section renders live integration surfaces; the device AI card offers a model select. `e2e:test:ai` / `@ai`.

## Child components

- Device: `-timezone`, `-locale`, `-theme`, `-currency`, `-ai` (Material combos / toggles wired via the `applySyncedComboField` helper in [helpers/ui/settings.ts](../helpers/ui/settings.ts)).
- App: `-bitcoin` → `-bitcoin-oracle`; `-ai` → `-ai-integration`, `-ai-agent(-form)`, `-ai-job(-dialog/-execute)`, `-ai-messaging`, `-ai-tool-chips`.
- User: `-user` → `-user-name`, `-user-password` → `-user-password-dialog`; `-messaging`.

## Unhappy / edge cases

- Password change opens a confirm dialog (`-user-password-dialog`) — a mutation, not exercised here.
- App-settings writes hit the server; re-driving them would desync the baked storageState. Read-only only.
- Device settings are localStorage — a fresh Playwright context re-reads the baked state, so the theme class is deterministic per stack.

## Template structure (at a glance)

```
/settings/device → Location(timezone,locale) · Theme · Currency(btc,fiat) · AI
/settings/app    → Bitcoin(oracle) · AI(integration…)
/settings/user   → User(name,password) · Messaging
```

## Interaction summary

| Gesture | Target | Result |
|---|---|---|
| Select | timezone/locale/currency combo | persists to localStorage, re-renders app formatting (not re-driven here) |
| Toggle | theme | swaps body class (not re-driven here) |
| Toggle | app bitcoin-oracle | server write (not exercised) |
| Click | change password | opens dialog (not exercised) |
| Click | Settings menu item (mobile) | scrolls to section |

## Test-author handoff

### Host page + setup

- `page.goto('/settings/device'|'/settings/app'|'/settings/user')`; storageState; settle on the first section title.
- Tag: `@all` structure. Theme differential keys on `config.deviceSettings?.theme`; oracle differential on `config.appSettings?.bitcoin_oracle`; AI surfaces `@ai`.

### Differential oracles

| Surface | Oracle |
|---|---|
| Applied theme | `config.deviceSettings?.theme` ([helpers/config.ts](../helpers/config.ts)) — body class |
| App oracle toggle | `config.appSettings?.bitcoin_oracle` |
| AI surfaces | `config.appSettings?.ai_enabled` |
| Structure | static per page |

### State reachability matrix

| State | lnd-nutshell-sqlite | lnd-cdk-sqlite | cln-cdk-postgres | cln-nutshell-postgres | fake-cdk-postgres |
|---|---|---|---|---|---|
| 1. Device structure | ✓ live | ✓ live | ✓ live | ✓ live | ✓ live |
| 2. Theme class | — (default) | ✓ light | ✓ dark | ✓ light | ✓ dark |
| 3. App structure | ✓ live | ✓ live | ✓ live | ✓ live | ✓ live |
| 4. Oracle on | — | — | — | ✓ live | — |
| 5. User structure | ✓ live | ✓ live | ✓ live | ✓ live | ✓ live |
| 6. Mobile menu | ✓ viewport | ✓ | ✓ | ✓ | ✓ |
| 7. AI surfaces | — | — | ✓ | — | — |

### Per-state probes

| State | Settled signal | Primary assert |
|---|---|---|
| 1 | `orc-settings-subsection-device-theme` visible | timezone/locale/theme/currency(×2)/ai cards present |
| 2 | body class settled | `document.body` class == `config.deviceSettings.theme` (skip if unset) |
| 3 | `orc-settings-subsection-app-bitcoin` visible | Bitcoin + AI sections present |
| 4 | oracle card visible | toggle checked iff `config.appSettings?.bitcoin_oracle` |
| 5 | `orc-settings-subsection-user-user` visible | User + messaging sections present |
| 6 | Settings button | visible at mobile viewport |

### Reusable interaction recipes

- Body-class read: `page.evaluate(() => document.body.className)`.
- Material combo *reads* (not writes): assert the trigger's rendered value text; never `preview_fill`.
- Do NOT reuse the `apply*` helpers here — they mutate and would desync storageState.

### Skip taxonomy

- Any control write (theme/locale/timezone/currency/oracle/password): `disruptive` — desyncs baked storageState / server settings; the apply path is already covered by `settings.setup.ts`.
- Password dialog: `disruptive`.
- AI live surfaces (state 7): `stack-only` via `e2e:test:ai`.

## Test fidelity hooks

- No prior standalone settings page spec; `settings.setup.ts` covers the apply/mutation path per stack.
- Planned: structure of all three pages (1, 3, 5), theme differential (2), oracle differential (4), mobile menu (6).
- Skipped: all writes (disruptive, covered by setup), AI live surfaces (stack-only).

## Notes for implementers

- `settings.setup.ts` is the mutation-side coverage; this spec is the read-side. Keep them complementary — if a control moves, update the helper, not this spec's assertions (which read persisted state, not the control internals).
- Theme is the cleanest cross-stack settings signal (a single body class) — it doubles as a smoke test that device settings survive the storageState round-trip.
