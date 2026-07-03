# `orc-auth-subsection-authentication` / `orc-auth-subsection-signup`

Source:
- Authentication: [auth-subsection-authentication.component.ts](../../src/client/modules/auth/modules/auth-subsection-authentication/components/auth-subsection-authentication/auth-subsection-authentication.component.ts) · form [`.html`](../../src/client/modules/auth/modules/auth-subsection-authentication/components/auth-subsection-authentication-form/auth-subsection-authentication-form.component.html)
- Signup: [auth-subsection-signup.component.ts](../../src/client/modules/auth/modules/auth-subsection-signup/components/auth-subsection-signup/auth-subsection-signup.component.ts) · form [`.html`](../../src/client/modules/auth/modules/auth-subsection-signup/components/auth-subsection-signup-form/auth-subsection-signup-form.component.html)

## Purpose

The logged-out `/auth` surfaces. **Authentication** (`/auth`) is the login form (Username + Password → JWT). **Signup** (`/auth/signup`) is invite-based account creation (Invite Key + Username + Password + Confirm). **Initialization** (`/auth/setup`) is first-run admin creation — covered by `setup/auth.setup.ts`, not here (it's fresh-stack-only and destructive).

`auth.setup.ts` already covers the login happy-path (it logs in every project) and the setup-form validation cases. This spec covers the **login/signup page structure and client-side validation** from a fresh (logged-out) context, complementing the setup coverage without re-driving a real login.

## Where it renders

- Auth section (`orc-auth-section`) under the exterior layout; routes gated by `initializationGuard` (redirect to `/auth/setup` when uninitialized). All shipped stacks are initialized, so `/auth` renders the login and `/auth/signup` the invite form.
- The section shows a route-transition overlay spinner (`overlayed()`).

## Happy path

1. Logged-out user hits any interior route → redirected to `/auth`.
2. Login form: Orchard logo (or facehash once a username is typed), "Orchard Login" title, Username + Password fields, a "Sign up" link, and a Login FAB disabled while the form is invalid.
3. Entering valid admin creds + Login authenticates and navigates to `/`.
4. "Sign up" → `/auth/signup`: Invite Key, Username, Password, Confirm Password form.

## Reachable states

### 1. Login form rendered

Title "Orchard Login", Username + Password fields, Sign up link. Login FAB disabled (empty form invalid).

### 2. Login FAB enabled

Both fields filled → FAB enabled. (Not submitted here — submitting valid creds is the setup helper's job; submitting invalid creds trips the throttler.)

### 3. Signup form rendered

`/auth/signup`: Invite Key, Username, Password, Confirm Password fields.

### 4. Facehash swap

Typing a username swaps the logo for a facehash avatar keyed on the name.

### 5. Route overlay

Transient spinner during `/auth/*` transitions.

## Child components

- `orc-auth-subsection-authentication-form`: the login form (name/password formcontrols, Login FAB).
- `orc-auth-general-formcontrol-name` / `-password`: reusable labelled inputs with cancel/error.
- `orc-auth-subsection-signup-form`: the invite signup form (Invite Key, Username, Password, Confirm).
- `orc-graphic-orchard-logo` / `orc-crew-facehash`: the header graphic (state 4).

## Unhappy / edge cases

- Empty form → Login FAB disabled (`form_group().invalid`).
- Signup validation surfaces per-field errors: Required, Password mismatch, min/max length, Invalid invite key, Username already exists.
- Wrong login credentials → server rejects, stays on `/auth`; repeated attempts trip the auth throttler (~4 req/10s) — why this spec does not submit bad creds.

## Template structure (at a glance)

```
orc-auth-section (overlay spinner)
├─ /auth        → auth-subsection-authentication → -form (logo/facehash · Username · Password · Login FAB · Sign up link)
└─ /auth/signup → auth-subsection-signup → -form (Invite Key · Username · Password · Confirm)
```

## Interaction summary

| Gesture | Target | Result |
|---|---|---|
| Type | Username / Password | enables Login FAB when valid; swaps logo→facehash |
| Click | Login FAB | authenticates (not exercised — setup owns it) |
| Click | Sign up link | navigates `/auth/signup` |
| Type + submit | signup form | creates account via invite (not exercised — needs a real invite) |

## Test-author handoff

### Host page + setup

- **Logged-out context**: `test.use({storageState: {cookies: [], origins: []}})` — the baked authed state would let interior routes render and change behaviour. `page.goto('/auth')`.
- **Reach signup via the link, not a hard load**: a direct `goto('/auth/signup')` in a logged-out context redirects to the login form (the SPA auth guard runs after the bundle boots). Navigate `/auth` then click the Sign up link so client-side routing keeps the signup render.
- Tag: `@all` (the login/signup pages render on every initialized stack).

### Differential oracles

| Surface | Oracle |
|---|---|
| Form structure | static (schema-fixed fields) |
| Admin creds | `TEST_ADMIN` ([helpers/config.ts](../helpers/config.ts)) — used only to enable the FAB, not to submit |

### State reachability matrix

| State | lnd-nutshell-sqlite | lnd-cdk-sqlite | cln-cdk-postgres | cln-nutshell-postgres | fake-cdk-postgres |
|---|---|---|---|---|---|
| 1. Login form | ✓ live | ✓ live | ✓ live | ✓ live | ✓ live |
| 2. FAB enabled | ✓ live | ✓ live | ✓ live | ✓ live | ✓ live |
| 3. Signup form | ✓ live | ✓ live | ✓ live | ✓ live | ✓ live |
| 4. Facehash swap | ✓ live | ✓ live | ✓ live | ✓ live | ✓ live |
| 5. Route overlay | — transient | — | — | — | — |

### Per-state probes

| State | Settled signal | Primary assert |
|---|---|---|
| 1 | "Orchard Login" visible | Username + Password fields; Login FAB disabled |
| 2 | fields filled | Login FAB enabled |
| 3 | signup form visible | Invite Key + Username + Password + Confirm fields |
| 4 | facehash present | typing a username renders `orc-crew-facehash` |

### Reusable interaction recipes

- Logged-out context: `test.use({storageState: {cookies: [], origins: []}})`.
- Field fill: `page.getByLabel('Username').fill(...)` — same as `auth.setup.ts`.

### Skip taxonomy

- Real login submit: `disruptive`/redundant — `auth.setup.ts` logs in every project already; submitting valid creds here would just duplicate it, invalid creds trip the throttler.
- Initialization (`/auth/setup`): `stack-only` (fresh stacks) + covered by `auth.setup.ts`.
- Signup submit: `disruptive` — needs a real invite token and creates a user.
- State 5 (overlay): `unit-better` — transient.

## Test fidelity hooks

- `auth.setup.ts` covers login happy-path + setup-form validation.
- Planned here: login form structure + FAB-disabled/enabled (1, 2), signup form structure (3), facehash swap (4).
- Skipped: real login/signup submit (disruptive/covered), initialization (setup-owned), overlay (transient).

## Notes for implementers

- The login FAB gating on `form_group().invalid` is the client-side guard; the server throttler is the real defense — do not add tests that hammer bad creds.
- Signup requires a live invite; a full signup e2e belongs with the crew spec's invite-creation flow (also currently skipped as disruptive) so the invite and its consumer are set up + torn down together.
