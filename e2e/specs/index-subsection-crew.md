# `orc-index-subsection-crew`

Source: [index-subsection-crew.component.ts](../../src/client/modules/index/modules/index-subsection-crew/components/index-subsection-crew/index-subsection-crew.component.ts) · [`.html`](../../src/client/modules/index/modules/index-subsection-crew/components/index-subsection-crew/index-subsection-crew.component.html)

## Purpose

The routed body of `/crew` — operator/user management. It renders a unified table of **users** and pending **invites**, a filter control (state + role), and a create-invite form (collapsible FAB). Rows open edit dialogs (user role/state edit; invite edit/cancel). Data comes from `CrewService` (`loadUsers` + `loadInvites`).

Because creating/editing users and invites mutates Orchard's own DB and the crew list every session shares, this spec is **read-only**: it asserts table structure, the deterministic seed-admin row, the filter surface, and that the create-invite form opens and closes — it never submits an invite or edits a user.

## Where it renders

- Lazy route `crew` of [`index-section.module.ts`](../../src/client/modules/index/modules/index-section/index-section.module.ts) at `/crew`; auth-only (no enable guard).
- The lazy module wires `canDeactivate` on a PENDING event (unsaved invite form → unsaved-changes dialog).
- Title `Orchard | Crew`.

## Derived / computed signals

- `device_type` — responsive column set.
- `filter_count` — active filter dimensions badge.
- `form_invite_create_open` — collapsible invite form open state.
- `data` — `MatTableDataSource<Invite | User>` (unified rows).

## Happy path

1. Navigate to `/crew`. Table renders users + pending invites; the seed admin (`admin`, role ADMIN) is always present.
2. Columns: User, Label, Created, State.
3. `person_add` FAB expands the create-invite form (Role select, Label, Date, Time). Cancelling/closing collapses it.
4. Filter button opens a menu: State (Active/Inactive/Pending) + Role (Admin/Manager/Reader) checkboxes.
5. Clicking a row opens its edit dialog (`-dialog-user` for users, `-dialog-invite` for invites).

## Reachable states

### 1. Table populated

At least the seed admin row. Observed live on canary (1 admin user). Columns User/Label/Created/State.

### 2. Create-invite form open / closed

`person_add` FAB toggles `orc-index-subsection-crew-form-invite` (collapsible with Role/Label/Date/Time). Cancel/close collapses. Registers a PENDING event while dirty.

### 3. Filter menu open

State (Active/Inactive/Pending) + Role (Admin/Manager/Reader) checkboxes; Clear all.

### 4. User edit dialog

Row click → `orc-index-subsection-crew-dialog-user` (role/state edit). Mutation surface — not exercised.

### 5. Invite edit / cancel dialog

Invite row click → `orc-index-subsection-crew-dialog-invite`. Mutation surface — not exercised.

### 6. Unsaved-changes guard

Navigating away with the invite form dirty opens the unsaved dialog (same as keysets/config pages).

### 7. Device variants

Column set narrows below desktop.

## Child components

- `orc-index-subsection-crew-control`: date-less filter menu (state/role) + filter badge.
- `orc-index-subsection-crew-table` (+ `-table-user`, `-table-invite`): unified rows.
- `orc-index-subsection-crew-form-invite` / `-form-user`: create/edit forms (Role select, Label, expiry Date/Time).
- `orc-index-subsection-crew-dialog-invite` / `-dialog-user`: per-row edit dialogs.

## Unhappy / edge cases

- Invite create validation (label maxLength 255, required role/expiry) blocks submit.
- Editing the current admin's own role/state is guarded server-side.
- Empty invite list → table shows users only.

## Template structure (at a glance)

```
orc-index-subsection-crew
├─ orc-index-subsection-crew-control (Filters: State + Role)  ·  person_add FAB
├─ (collapsible) orc-index-subsection-crew-form-invite (Role, Label, Date, Time)
└─ orc-index-subsection-crew-table  (User | Label | Created | State)
   └─ row click → -dialog-user / -dialog-invite
```

## Interaction summary

| Gesture | Target | Result |
|---|---|---|
| Click | `person_add` FAB | Toggles create-invite form |
| Click | Filters button | Opens state/role menu |
| Check | state/role checkbox | Filters rows |
| Click | user row | Opens user edit dialog (mutation) |
| Click | invite row | Opens invite dialog (mutation) |
| Submit | invite form | Creates invite (mutation) |
| Navigate | while form dirty | Unsaved dialog |

## Test-author handoff

### Host page + setup

- `page.goto('/crew')`; storageState; settle on the crew table visible.
- Tag: `@all` — every stack seeds an admin; the surface is backend-agnostic.

### Differential oracles

| Surface | Oracle |
|---|---|
| Seed admin row | deterministic: username `admin` (`TEST_ADMIN.name`), role ADMIN |
| User count | `orchard.userCount(config)` — gap: add to [backend/orchard.ts](../helpers/backend/orchard.ts) if a count differential is wanted (seed admin makes the row assertion sufficient today) |
| Filter options | static enums (State ×3, Role ×3) |

### State reachability matrix

| State | lnd-nutshell-sqlite | lnd-cdk-sqlite | cln-cdk-postgres | cln-nutshell-postgres | fake-cdk-postgres |
|---|---|---|---|---|---|
| 1. Table + admin row | ✓ live | ✓ live | ✓ live | ✓ live | ✓ live |
| 2. Invite form open/close | ✓ live | ✓ live | ✓ live | ✓ live | ✓ live |
| 3. Filter menu | ✓ live | ✓ live | ✓ live | ✓ live | ✓ live |
| 4. User dialog | — disruptive | — | — | — | — |
| 5. Invite dialog | — disruptive | — | — | — | — |
| 6. Unsaved guard | ✓ live | ✓ live | ✓ live | ✓ live | ✓ live |
| 7. Device variants | ✓ viewport | ✓ | ✓ | ✓ | ✓ |

### Per-state probes

| State | Settled signal | Primary assert |
|---|---|---|
| 1 | `orc-index-subsection-crew-table` visible | columns User/Label/Created/State; a row containing `admin` + `ADMIN` |
| 2 | `orc-index-subsection-crew-form-invite` visible | FAB opens the form; close collapses it |
| 3 | `.cdk-overlay-container orc-form-filter-menu` visible | State + Role headers; 6 checkboxes |
| 6 | `orc-event-general-unsaved-dialog` | nav while form dirty → dialog; Stay cancels |

### Reusable interaction recipes

- FAB toggle + collapsible: `.click()` then assert the form's presence/absence.
- Filter menu: same recipe as event-log / keysets specs.
- Unsaved guard: trigger via in-app nav (secondary/primary nav), not `page.goto`.

### Skip taxonomy

- Invite create submit, user/invite edit dialogs: `disruptive` — mutate Orchard's user/invite tables that every session shares; a dedicated isolated-context spec with teardown could own the create→cancel round-trip later.
- Own-admin role edit: `dead-branch`/guarded — server rejects.
- Device column internals: `unit-better`.

## Test fidelity hooks

- No prior `index-subsection-crew.spec.ts`.
- Planned: states 1, 2, 3 (+ optionally 6).
- Skipped: 4, 5 (disruptive mutations), submit flows.

## Notes for implementers

- The seed admin row is the deterministic anchor for read-only assertions — do not remove or rename the e2e admin without updating this spec.
- Invite/user creation needs teardown; if a future spec exercises it, gate to a single stack with an afterEach that cancels the created invite / deletes the created user via the same dialogs.
- `canDeactivate` blocks nav only on PENDING (dirty invite form) — same rule as the keysets/config pages.
