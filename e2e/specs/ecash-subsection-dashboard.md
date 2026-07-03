# `orc-ecash-subsection-dashboard`

Source: [ecash-subsection-dashboard.component.ts](../../src/client/modules/ecash/modules/ecash-subsection-dashboard/components/ecash-subsection-dashboard/ecash-subsection-dashboard.component.ts) · [`.html`](../../src/client/modules/ecash/modules/ecash-subsection-dashboard/components/ecash-subsection-dashboard/ecash-subsection-dashboard.component.html)

## Purpose

The routed body of `/ecash`. A **placeholder stub**: a `payments` icon and the static string "Ecash Dashboard Coming Soon!". The component class is empty — no inputs, outputs, services, or signals. Unlike `/lightning`, the host wrapper `orc-ecash-section` is also empty chrome: a bare `section.section-container > div.subsection-container > router-outlet` with **no secondary nav, no data fetch** ([ecash-section.component.html](../../src/client/modules/ecash/modules/ecash-section/components/ecash-section/ecash-section.component.html)).

## Where it renders

- **Only usage**: lazy child route `''` of [`ecash-section.module.ts`](../../src/client/modules/ecash/modules/ecash-section/ecash-section.module.ts), mounted at `/ecash`.
- **No `enabledGuard`** — unlike bitcoin/lightning/mint, the ecash section has no disabled redirect ([routing.module.ts:42-45](../../src/client/modules/routing/routing.module.ts#L42)). The route mounts on every stack, including `fake-cdk-postgres`. Only `initializationGuard` + `authenticationGuard` gate it (as with every interior route).
- Route title: `Orchard | Ecash`.

## Inputs

| Input | Type | Required | Notes |
|---|---|---|---|
| — | — | — | None. Static template. |

## Outputs & projected content

- None.

## Derived / computed signals

- None.

## Happy path

1. Authenticated user navigates to `/ecash`.
2. `orc-ecash-section` renders its empty shell; the stub mounts synchronously.
3. `.ecash-dashboard-container` shows `mat-icon` `payments` + "Ecash Dashboard Coming Soon!". Document title becomes `Orchard | Ecash`.

## Reachable states

### 1. Stub populated (the only state)

Static. No variation by stack, data, or device. Observed live on `lnd-nutshell-sqlite`: container unique, icon ligature `payments`, exact text match.

## Child components

None. (`orc-ecash-general-note` lives in the ecash module but renders on the index dashboard's ecash tile, not here — it belongs to that spec.)

## Unhappy / edge cases

- None reachable: there is no data path into this component. The only failure mode is routing-level (unauthenticated → `/auth` redirect via `authenticationGuard`), which is auth-spec territory.

## Template structure (at a glance)

```
orc-ecash-section
└─ section.section-container
   └─ div.subsection-container
      └─ router-outlet → orc-ecash-subsection-dashboard
         └─ div.ecash-dashboard-container.p-1
            ├─ mat-icon.icon-lg "payments"
            └─ div "Ecash Dashboard Coming Soon!"
```

## Interaction summary

| Gesture | Target | Result |
|---|---|---|
| — | — | No interactive elements. |

## Test-author handoff

### Host page + setup

- Route: `page.goto('/ecash')`; storageState auth; no waits beyond the container's own visibility.
- Tag: `@all` — the route is guard-free and identical everywhere; running it on all five stacks proves the section mounts with and without bitcoin/LN/mint backends (the actual point of coverage for a guard-free route).

### Differential oracles

| Surface | Oracle |
|---|---|
| Stub text/icon/title | Static — no oracle. |

### State reachability matrix

| State | lnd-nutshell-sqlite | lnd-cdk-sqlite | cln-cdk-postgres | cln-nutshell-postgres | fake-cdk-postgres |
|---|---|---|---|---|---|
| 1. Stub populated | ✓ live | ✓ live | ✓ live | ✓ live | ✓ live |

### Per-state probes

| State | Settled signal | Primary assert |
|---|---|---|
| 1. Stub | `orc-ecash-subsection-dashboard .ecash-dashboard-container` visible | icon text `payments`; `getByText('Ecash Dashboard Coming Soon!')`; `expect(page).toHaveTitle('Orchard | Ecash')` |

Locator verified unique live (`querySelectorAll(...).length === 1`).

### Reusable interaction recipes

- None needed.

### Skip taxonomy

- Nothing skipped — the full surface is one static state.

## Test fidelity hooks

- No prior `ecash-subsection-dashboard.spec.ts`. The planned spec covers state 1 on all five stacks. Nothing else exists to cover.

## Notes for implementers

- When the real Ecash dashboard ships, both this stub spec and the missing `enabledGuard` question deserve a revisit — today `/ecash` renders even when the mint backend is absent, which may or may not remain intentional.
- The section shell has no header: if ecash grows secondary nav like mint/lightning, expect this spec to inherit the alias/version/chrome sections from the lightning page spec pattern.
