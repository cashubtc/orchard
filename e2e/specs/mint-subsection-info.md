# `orc-mint-subsection-info`

Source: [mint-subsection-info.component.ts](../../src/client/modules/mint/modules/mint-subsection-info/components/mint-subsection-info/mint-subsection-info.component.ts) · [`.html`](../../src/client/modules/mint/modules/mint-subsection-info/components/mint-subsection-info/mint-subsection-info.component.html)

## Purpose

The **Info** subsection page at `/mint/info`. Edits the mint's NUT-06 metadata (name, short/long descriptions, icon URL, contact methods, connection URLs, message of the day) against the local mint daemon. The component owns:

- a single `FormGroup` wired to every editable NUT-06 field
- a per-field "save / cancel / help" recipe via `orc-form-field-dynamic` (the children are dumb forms — the parent decides the persistence strategy)
- a dirty-counter signal piped through `EventService` so the global nav chip ("1 update", "N updates") tracks the form's pending edits and the user can confirm-all from the chip
- two persistence flows: per-control `onControlUpdate(key)` calls the matching single-field GraphQL mutation; the chip-confirm path bundles every dirty control into one `BulkMintUpdate` mutation. Cancel discards via `setValue(init_info[key])`.
- AI tool-call handling (when `ai_enabled`) that mutates the form on the user's behalf and routes through the same dirty-count → confirm flow

It is `OnPush`, runs `cdr.detectChanges()` after every mutation/dirty re-evaluation, has a `canDeactivate()` guard that returns false when a `PENDING` event is active, and tears down its subscriptions in `ngOnDestroy`.

## Where it renders

- **Only usage**: route `/mint/info`, lazy-loaded via `OrcMintSubsectionInfoModule` from [mint-section.module.ts:141-156](../../src/client/modules/mint/modules/mint-section/mint-section.module.ts#L141). Gated by `enabledGuard` (mint feature must be enabled in runtime config).
- The route resolver pre-loads `mint_info_rpc: MintInfoRpc` into `route.snapshot.data`; the component reads it synchronously in `ngOnInit` and patches the form, so the form is populated on first render with no async hop.
- The breakpoint observer drives `device_type()` (`mobile` / `tablet` / `desktop`) which only affects two things in this component: the container's outer padding (`p-2` desktop, `p-1` else) and the `device_mobile` flag piped to MOTD + Contacts children.

## Inputs

This component takes no `@Input()`s — it is a routed page. The state surface comes from route data + services + saved per-device settings:

| Source | Type | Where it ends up | Notes |
|---|---|---|---|
| `route.data.mint_info_rpc` | `MintInfoRpc` | `init_info` | Server-side resolver via `mintInfoRpcResolver`, hitting `mint_info_rpc` GraphQL query ([mint.queries.ts:104](../../src/client/modules/mint/services/mint/mint.queries.ts#L104)) which proxies the daemon's NUT-06 `/v1/info`. |
| `router.currentNavigation().extras.state.focus_control` | `string \| null` | `focus_control` | When the user navigates here from another page asking to focus a specific control (e.g. nav action "Edit name"), the constructor reads it and the matching child receives `[focused]="true"`. Recognised keys: `'name'`, `'icon_url'`. (description / description_long / motd / urls / contact children don't bind `focused`.) |
| `BreakpointObserver` | `BreakpointState` | `device_type` signal | XSmall → `mobile`, Small\|Medium → `tablet`, else `desktop`. |
| `SettingAppService.getSetting('ai_enabled')` | `boolean` | gated subscriptions | When true, `orchardOptionalInit()` adds the `assistant_requests$` and `tool_calls$` subscriptions. |
| `EventService.getActiveEvent()` | `EventData \| null` | `active_event` | The global event-chip stream. Used to detect the user's "confirm" / "cancel" decision on a `PENDING` summary event. |

## Outputs & projected content

- No `@Output()`s — this is a top-level routed page.
- No `<ng-content>` slots in the parent template. (The icon child has its own `<ng-content>` slot — the parent projects the **name** + **description** children into it, see template structure below.)

## Derived / computed signals

The parent intentionally keeps very little reactive state — most computed logic lives in the children. Parent-owned signals:

- `device_type` → `'desktop' \| 'tablet' \| 'mobile'`. Set by `BreakpointObserver`. Drives container padding and is forwarded to `orc-mint-subsection-info-form-motd[device_mobile]` and `orc-mint-subsection-info-form-contacts[device_mobile]`.
- `dirty_count` → `number`. Recomputed in `evaluateDirtyCount()` whenever the form value changes: count of dirty top-level `FormControl`s + count of dirty controls inside the two `FormArray`s. Used solely to drive the global event chip via `EventService.registerEvent(new EventData({type: 'PENDING', message: 'N updates'}))`. `dirty_count$` is a `toObservable(...)` wrapper so the chip update fires once per actual count change, not once per keystroke.
- `active_event` (plain field, not a signal) → mirrors `EventService.getActiveEvent()`. Cleared (`null`) re-runs `evaluateDirtyCount()`. A non-null event with `confirmed === true` triggers the bulk mutation; `confirmed === false` cancels every dirty control back to `init_info`.

## Happy path

1. Router resolves `mint_info_rpc`. `ngOnInit` patches the form with `name`, `description`, `icon_url`, `description_long`, `motd`, then pushes one `FormControl` per `init_info.urls` entry into the `urls` `FormArray` and one `FormGroup({method, info})` per `init_info.contact` entry into the `contact` `FormArray`.
2. The four subscriptions wire up: event chip, form value-change → `evaluateDirtyCount`, dirty-count → `createPendingEvent`, breakpoint observer → `device_type`. If `ai_enabled` is true, the assistant + tool-call subscriptions wire up too.
3. Each child renders cold (light outline, no save button) because nothing is dirty. Single-field validation (name maxLength 200, urls/contacts `required`) is dormant.
4. The user edits a control. The form-value subscription fires → `evaluateDirtyCount()` → `dirty_count.set(N)` → `createPendingEvent(N)` → `EventService.registerEvent({type: 'PENDING', message: 'N update(s)'})`. The matching child's `form_field_dynamic` flips to "hot" (save / cancel buttons appear).
5. The user can either:
   - press the per-field save (Enter or click) → child emits `update(controlName)` → parent's `onControlUpdate` calls the matching single-field mutation, optimistically syncs `init_info[key]` from the response, marks the control pristine, fires a `SUCCESS` event;
   - or click the global event chip's confirm → `EventService` flips the `PENDING` event's `confirmed` to `true` → `onConfirmedEvent()` builds and runs `BulkMintUpdate` covering every dirty field, then refetches `mint_info_rpc`, replaces `init_info`, and resets the form to pristine.
6. Cancel (Escape, child cancel button, or the chip's cancel) → `onControlCancel(key)` (or `onArrayControlCancel`) → `setValue(init_info[key])` + `markAsPristine()`.

## Reachable states

### 1. Pristine (page mount, no edits)

- All children cold (no save/cancel suffix on their dynamic form fields).
- Event chip empty / dismissed.
- `dirty_count() === 0`. `active_event` may be the page-level "subscribed" event from neighbouring components, but no `PENDING` from this component.
- Default fixture state for `lnd-nutshell-sqlite` after `e2e:up`: name `e2e-nutshell`, description `Orchard e2e lnd-nutshell-sqlite`, icon empty, long description empty, urls `["https://nut-sat-lite.cash"]`, contacts `[{method: 'email', info: 'e2e@orchard.local'}]`, motd null.

### 2. Single-field dirty

Edit one control without saving.

- The matching child flips to "hot" (`orc-hot-form-field` background, save + cancel suffixes appear via `orc-form-field-dynamic`).
- Global event chip shows `PENDING` with message `1 update`.
- Other children stay cold.

### 3. Multi-field dirty

Edit two or more controls (top-level + array entries count individually).

- Each touched child flips hot.
- Global event chip shows `PENDING` with message `N updates`.
- `evaluateDirtyCount()` formula: `count(dirty top-level FormControls) + sum(count(dirty controls in each FormArray))`. Editing both `method` and `info` of one contact subgroup counts as 2.

### 4. Single-field save (per-control mutation)

User presses Enter or clicks the child's save suffix.

- `onControlUpdate(key)` runs the field-specific mutation (`updateMintName` / `updateMintDescription` / `updateMintIcon` / `updateMintDescriptionLong` / `updateMintMotd`).
- Optimistic: on success, sets `init_info[key] = response.<mutation>.<field> ?? null`, fires `SUCCESS` event "Information updated!", calls `mintService.clearInfoCache()` and `loadMintInfo()` so other consumers refetch, marks the control pristine. Form-as-a-whole stays dirty if other controls were also dirty.
- On error, fires `ERROR` event with `errors.errors[0].getFullError()`. The dirty bit is not rolled back — the user can retry or cancel.

### 5. Bulk save (chip confirm)

User clicks the event chip's confirm.

- `EventService` flips the `PENDING` event's `confirmed = true` → `onConfirmedEvent()`.
- If `form_info.invalid`, registers a `WARNING` event "Invalid info" and stops.
- If contact methods have a duplicate (`hasDuplicateContactMethods()`), registers an `ERROR` event "Contact method already set: <method>" and stops.
- Otherwise composes a single `mutation BulkMintUpdate(...)` containing only the dirty bits: name, description, description_long, icon_url, motd as scalar updates; URL deltas as `mint_url_remove` + `mint_url_add` aliases; contact deltas as `mint_contact_remove` + `mint_contact_add` aliases. Fires `SAVING` event, runs the mutation, then refetches `mint_info_rpc` and replaces `init_info`. On success, calls `onSuccess(true)` which marks the whole form pristine and resets `dirty_count` to 0.

### 6. Bulk cancel (chip cancel)

User dismisses the chip.

- `EventService` flips `confirmed = false` → `onUnconfirmedEvent()`.
- For each dirty top-level control: `onControlCancel(key)` → `setValue(init_info[key])`.
- For each dirty `FormArray`: walks the array high-to-low. Indices `>= init_info.<array>.length` are removed; existing dirty entries are reverted via `onArrayControlCancel`.
- Form returns to pristine; `dirty_count` re-evaluates to 0; chip clears.

### 7. Saving (transient)

After the user confirms, before the mutation resolves.

- A `SAVING` event is active in the global chip.
- The form is still mutable in principle, but the rest of the app treats `SAVING` as a busy state. This component has no internal "saving" disable — it relies on the chip UX.

### 8. Validation error — invalid name

Name longer than 200 chars (`Validators.maxLength(200)`).

- The name child shows `mat-error` "Invalid name" via `orc-form-error`.
- Per-field save no-ops: `onControlUpdate` returns early if `form_info.get('name').invalid`.
- Bulk save short-circuits in `onConfirmedEvent` with a `WARNING` event "Invalid info".

### 9. Validation error — duplicate contact methods

Two contact subgroups with the same `method` value (e.g. both `email`).

- The child does not block the input — duplicates only error at save time.
- `hasDuplicateContactMethods()` is checked in three places: `onConfirmedEvent` (bulk save), `addMintContact`, `updateMintContact`.
- When triggered, registers an `ERROR` event "Contact method already set: <method>" and aborts the mutation.

### 10. Validation error — empty required URL / contact field

URLs are `Validators.required`; contact subgroups have `required` on both `method` and `info`.

- Empty URL: child shows red outline + "Invalid URL" mat-error once touched/dirty.
- Empty contact info or method: subgroup shows "Contact is required" / "Invalid contact" mat-error.
- `onArrayControlUpdate` no-ops when the entry is invalid.

### 11. Mutation error

Server returns errors → `OrchardErrors` arrives in the `error` callback.

- Registers an `ERROR` event whose message is `errors.errors[0].getFullError()`.
- The dirty state is preserved (no rollback). The user can edit further or cancel.

### 12. canDeactivate guard

The user navigates away while a `PENDING` event is active.

- `@HostListener('window:beforeunload') canDeactivate()` returns `false`. The `ComponentCanDeactivate` interface contract delegates to `routing.guard.ts` (out of scope here) which typically opens `event-general-unsaved-dialog`.
- Returns `true` for `SAVING`, `SUCCESS`, `WARNING`, `ERROR`, or null events.

### 13. AI tool-call mutation (when `ai_enabled`)

Assistant fires a tool call matching one of `MintNameUpdate` / `MintDescriptionUpdate` / `MintIconUrlUpdate` / `MintDescriptionLongUpdate` / `MintMotdUpdate` / `MintUrlAdd` / `MintUrlUpdate` / `MintUrlRemove` / `MintContactAdd` / `MintContactUpdate` / `MintContactRemove`.

- The matching control is `setValue(...)`'d and `markAsDirty`'d. URL/contact add tool calls also push a new control via `onAddUrlControl` / `onAddContactControl`.
- Re-runs `evaluateDirtyCount` + `cdr.detectChanges`. The user still has to confirm via the chip — the AI cannot bypass the dirty-count gate.
- `MintUrlUpdate` / `MintUrlRemove` no-op when the old URL is not currently in `init_info.urls`. `MintContactUpdate` / `MintContactRemove` match by both `method` and `info`.

### 14. Device-type variants

- `mobile`: container padding `p-1`; `orc-mint-subsection-info-form-motd[device_mobile]=true` drops the chat-bubble icon; `orc-mint-subsection-info-form-contacts[device_mobile]=true` propagates to each contact, which adds `mobile-contact-container` (CSS stacks the method-select + info input vertically).
- `tablet`: container padding `p-1`; children behave as desktop.
- `desktop`: container padding `p-2`; full chat-bubble icon on MOTD; contacts inline.

## Child components

All children are presentational forms; the parent owns persistence. None opens a dialog or bottom sheet of its own.

### `orc-mint-subsection-info-form-icon`

Source: [mint-subsection-info-form-icon.component.ts](../../src/client/modules/mint/modules/mint-subsection-info/components/mint-subsection-info-form-icon/mint-subsection-info-form-icon.component.ts) · [`.html`](../../src/client/modules/mint/modules/mint-subsection-info/components/mint-subsection-info-form-icon/mint-subsection-info-form-icon.component.html)

- Inputs: `form_group` (required), `control_name: 'icon_url'`, `icon_url` (current saved value), `focused` (auto-focus textarea on mount when true).
- Outputs: `update`, `cancel`.
- `<ng-content>` slot inside the right-hand "id-card" content panel — the parent projects the **name** child and **description** child into it. (Visible in the screenshot: the icon's circular drop-zone sits to the left of the Name + Description fields.)
- Owns a debounced (`debounceTime(500)`) `valueChanges` subscription on the icon URL control. Each new value runs `renderIconUrl(url)`, which:
  1. sets `form_url` so `display_icon_url()` reflects the typed value;
  2. flips `url_loading.set(true)`;
  3. instantiates `new Image(); img.src = url`;
  4. on `onload`, after another 500ms (`LOAD_ICON_SLEEP`) → `url_loading=false`, `url_valid=true`;
  5. on `onerror`, after the same delay → `url_loading=false`, `url_valid=false`, sets `{error: 'Invalid URL'}` on the control so the bulk-save validity check fails.
- `icon_state` computed branches: `'unset'` (no URL value), `'loading'` (image probe in flight), `'set'` (image resolved), `'error'` (image rejected).
- Cancel resets `form_url` to the saved `icon_url`.

### `orc-mint-subsection-info-form-name`

Source: [mint-subsection-info-form-name.component.ts](../../src/client/modules/mint/modules/mint-subsection-info/components/mint-subsection-info-form-name/mint-subsection-info-form-name.component.ts) · [`.html`](../../src/client/modules/mint/modules/mint-subsection-info/components/mint-subsection-info-form-name/mint-subsection-info-form-name.component.html)

- Inputs: `form_group`, `control_name: 'name'`, `focused`.
- Outputs: `update`, `cancel`.
- `form_hot` computed: true when the input has focus OR the control is dirty. Drives the wrapper's `orc-hot-form-field` / `orc-cold-form-field` class swap and `[hot]` on `orc-form-field-dynamic` (which surfaces save / cancel / info suffix buttons when hot).
- `help_status` toggles a collapsible `orc-form-help-text` block under the field.
- `afterNextRender` focuses the input if `focused()`.
- `onSubmit(event)` emits `update(control_name)` and blurs the input.

### `orc-mint-subsection-info-form-description`

Source: [mint-subsection-info-form-description.component.ts](../../src/client/modules/mint/modules/mint-subsection-info/components/mint-subsection-info-form-description/mint-subsection-info-form-description.component.ts) · [`.html`](../../src/client/modules/mint/modules/mint-subsection-info/components/mint-subsection-info-form-description/mint-subsection-info-form-description.component.html)

- Inputs: `form_group`, `control_name: 'description'`. No `focused`.
- Outputs: `update`, `cancel`.
- Identical save/cancel/help recipe as the name child but with a `formAutogrow` textarea, no validators on the parent's `description` `FormControl`, and a different mat-label.

### `orc-mint-subsection-info-form-description-long`

Source: [mint-subsection-info-form-description-long.component.ts](../../src/client/modules/mint/modules/mint-subsection-info/components/mint-subsection-info-form-description-long/mint-subsection-info-form-description-long.component.ts) · [`.html`](../../src/client/modules/mint/modules/mint-subsection-info/components/mint-subsection-info-form-description-long/mint-subsection-info-form-description-long.component.html)

- Inputs: `form_group`, `control_name: 'description_long'`. Outputs: `update`, `cancel`.
- Same shape as the short-description child; the only differences are the mat-label ("Long description"), placeholder, and help-text copy.

### `orc-mint-subsection-info-form-urls`

Source: [mint-subsection-info-form-urls.component.ts](../../src/client/modules/mint/modules/mint-subsection-info/components/mint-subsection-info-form-urls/mint-subsection-info-form-urls.component.ts) · [`.html`](../../src/client/modules/mint/modules/mint-subsection-info/components/mint-subsection-info-form-urls/mint-subsection-info-form-urls.component.html)

- Inputs: `form_group`, `form_array` (required), `array_name: 'urls'`, `array_length`.
- Outputs: `addControl: void`, `update / cancel / remove: {array_name, control_index}`.
- Section title "Connection URLs" + info button toggling a help block. Renders one `orc-mint-subsection-info-form-url` per `form_array().controls` entry, plus a tonal "+ New URL" button.
- `onAddControl()` records `added_index = form_array().length` so the *next* rendered url child receives `[focused]="true"`. `addControl` event is what the parent listens to (parent calls `onAddUrlControl()` to actually push a `FormControl(null, [Validators.required])` into the array and mark it dirty).
- `ngOnInit` subscribes to `form_array().events` and runs `cdr.markForCheck()` so the children re-render when the parent mutates the array (e.g. after a successful add the parent pops the latest pristine).

### `orc-mint-subsection-info-form-url`

Source: [mint-subsection-info-form-url.component.ts](../../src/client/modules/mint/modules/mint-subsection-info/components/mint-subsection-info-form-url/mint-subsection-info-form-url.component.ts) · [`.html`](../../src/client/modules/mint/modules/mint-subsection-info/components/mint-subsection-info-form-url/mint-subsection-info-form-url.component.html)

- Inputs: `form_group`, `form_array`, `array_name`, `control_index`, `control_dirty`, `focused`.
- Outputs: `update(index)`, `cancel(index)`, `remove(index)`.
- `url_icon` signal seeded in `ngAfterViewInit` from `getUrlIcon()`:
  - ends with `.onion` → `'tor'` (rendered as `<mat-icon svgIcon="tor">`)
  - starts with `https` → `'vpn_lock_2'`
  - else → `'language'` (default)
- `form_hot` computed: focused OR dirty. `control_invalid` computed: not focused AND (control invalid AND (dirty OR touched)). Note: the icon is only set once (`AfterViewInit`) — typing a URL after mount does not refresh the icon.
- Mat-suffix delete button calls `onRemove($event)` → emits `remove(index)`. Parent's `onArrayControlRemove` removes pristine entries directly; for entries already persisted it calls the `mint_url_remove` mutation.

### `orc-mint-subsection-info-form-contacts`

Source: [mint-subsection-info-form-contacts.component.ts](../../src/client/modules/mint/modules/mint-subsection-info/components/mint-subsection-info-form-contacts/mint-subsection-info-form-contacts.component.ts) · [`.html`](../../src/client/modules/mint/modules/mint-subsection-info/components/mint-subsection-info-form-contacts/mint-subsection-info-form-contacts.component.html)

- Inputs: `form_group`, `form_array`, `array_name: 'contact'`, `array_length`, `device_mobile`.
- Outputs: `addControl`, `update / cancel / remove: {array_name, control_index}`.
- Same shape as the URLs section: title + help, list of `orc-mint-subsection-info-form-contact`, "+ New Contact" tonal button.
- `getAddedMethod()` picks the *first* unused method from `['email', 'twitter', 'nostr']` and seeds the new contact subgroup's `method` via `init_method`. Falls back to `email` when all three are taken — which is also the path that produces the duplicate-method error on save.

### `orc-mint-subsection-info-form-contact`

Source: [mint-subsection-info-form-contact.component.ts](../../src/client/modules/mint/modules/mint-subsection-info/components/mint-subsection-info-form-contact/mint-subsection-info-form-contact.component.ts) · [`.html`](../../src/client/modules/mint/modules/mint-subsection-info/components/mint-subsection-info-form-contact/mint-subsection-info-form-contact.component.html)

- Inputs: `form_group`, `form_array`, `array_name`, `subgroup_index`, `focused`, `init_method`, `device_mobile`.
- Outputs: `update(index)`, `cancel(index)`, `remove(index)`.
- `mat-select` with three hardcoded options:
  - Email — material icon `mail`
  - X — svg icon `x`
  - Nostr — svg icon `nostr`
- Trigger renders the selected option's icon + label. `method_form_hot` and `info_form_hot` are independent — each half of the row flips hot/cold separately. `group_invalid` is true when the subgroup is invalid AND (dirty OR touched).
- `mobile-contact-container` CSS stacks the select on top of the info input on mobile.
- Mat-suffix delete button next to the info input emits `remove(index)`.

### `orc-mint-subsection-info-form-motd`

Source: [mint-subsection-info-form-motd.component.ts](../../src/client/modules/mint/modules/mint-subsection-info/components/mint-subsection-info-form-motd/mint-subsection-info-form-motd.component.ts) · [`.html`](../../src/client/modules/mint/modules/mint-subsection-info/components/mint-subsection-info-form-motd/mint-subsection-info-form-motd.component.html)

- Inputs: `form_group`, `control_name: 'motd'`, `motd` (saved value), `device_mobile` (required signal input).
- Outputs: `update`, `cancel`.
- `motd_state` getter: `'hot'` when focused or dirty; else `'unset'` when the value is null/empty; else `'set'`. Drives a three-way background swap (`hot-motd` / `unset-motd` / `set-motd`).
- Renders a chat-bubble icon on the left (hidden on mobile via `@if (!device_mobile())`), a "Message of the Day" label + textarea, and a delete-button mat-suffix that only renders when `motd` (the saved value, not the form value) is truthy.
- `onDelete` clears the form value to null and immediately emits `update` — i.e. delete persists in one click without going through the chip.
- `onSubmit` runs `setTimeout(() => autogrow.grow(), 10)` after emitting update so the textarea re-measures after the value reconciles.

## Unhappy / edge cases

- **`init_info.urls` missing or non-array** — the `Array.isArray` guard skips the loop, leaving the `urls` `FormArray` empty; UI shows the "+ New URL" button only.
- **`init_info.contact` missing or non-array** — same, the contacts `FormArray` stays empty.
- **Duplicate URL added** — the URL field has no uniqueness validator. The bulk-save delta computation in `onConfirmedEvent` deduplicates via `Array.includes` on `new_urls` vs `old_urls`, so a typed-twice value resolves to a single add. The duplicate stays as a separate row in the form until refetch.
- **All three contact methods used** — the auto-method selector picks `email` for the fourth, immediately producing a duplicate. `hasDuplicateContactMethods()` blocks save and the user must manually flip the new contact to a unique method.
- **Icon URL points to a slow image** — the validity probe runs in the page (no CSP / cache implications for the form) but each new keystroke debounces 500ms then triggers another `Image()` load; rapid typing leaves the field in `'loading'` state until the user pauses.
- **Icon URL points to a CORS-restricted image** — `img.onerror` fires → `'error'` state → the control is given a synthetic `{error: 'Invalid URL'}`. Bulk save will be blocked by the WARNING event because the form is invalid.
- **Mutation succeeds but `mint_info_rpc` refetch fails** — `init_info` is left at the pre-save value while the form is pristine; the next per-field save will attempt to add/remove URLs against the stale `init_info.urls`. Not catastrophic; the user can refresh.
- **AI tool call references a URL not in `init_info.urls`** — `MintUrlUpdate` / `MintUrlRemove` early-return without surfacing an error to the user. Same for contact tool calls that don't match an existing contact.
- **`canDeactivate` returns false but the user closes the tab** — `beforeunload` does not show a confirmation dialog from this component (the `ComponentCanDeactivate` contract is consulted by Angular's router guards, not the browser's beforeunload). A hard close loses pending edits silently.

## Template structure (at a glance)

```
.mint-subsection-info-container [p-1 | p-2]
└── mat-card
    └── mat-card-content
        ├── flex-wrap row
        │   ├── flex-1 column (left)
        │   │   ├── orc-mint-subsection-info-form-icon
        │   │   │   └── ng-content (projected)
        │   │   │       ├── orc-mint-subsection-info-form-name
        │   │   │       └── orc-mint-subsection-info-form-description
        │   │   └── orc-mint-subsection-info-form-description-long
        │   └── flex-1 column (right)
        │       ├── orc-mint-subsection-info-form-urls
        │       │   └── @for orc-mint-subsection-info-form-url
        │       └── orc-mint-subsection-info-form-contacts
        │           └── @for orc-mint-subsection-info-form-contact
        └── orc-mint-subsection-info-form-motd
```

## Interaction summary

| Gesture | Target | Result |
|---|---|---|
| type into Name | name input | dirties `name` control → `1 update` chip; child flips hot |
| Enter / click save in Name child | `orc-mint-subsection-info-form-name` save suffix | `onControlUpdate('name')` → `mint_name_update` mutation → SUCCESS event |
| Esc / click cancel in Name child | name child cancel suffix | `onControlCancel('name')` → resets to `init_info.name` |
| toggle Name help (i) | name child info suffix | toggles `help_status` → expands/collapses help text block |
| type into Description / Long description / Icon URL | matching textarea | same recipe as name; help-text icon present on each |
| type into Icon URL | icon child textarea | debounced 500ms → image probe → `icon_state` flips loading → set / error; on error, control becomes invalid |
| click empty icon avatar | icon child `.mint-icon-display` | focuses the textarea (`onIconClick`) |
| click "+ New URL" | urls child tonal button | `addControl` → parent `onAddUrlControl()` pushes new required `FormControl(null)` and marks dirty; new url child renders with `[focused]=true` |
| type into a URL row | url child input | dirties the array entry; chip count goes up |
| Enter in URL row | url child form | `update(index)` → `onArrayControlUpdate('urls', i)` → `mint_url_add` (new) or `mint_url_update` (existing) |
| click delete on URL row | url child mat-suffix | `remove(index)` → `onArrayControlRemove('urls', i)` → splice for pristine, `mint_url_remove` for persisted |
| toggle URL section help (i) | urls child header info button | toggles help block |
| click "+ New Contact" | contacts child tonal button | `addControl` → parent pushes a new `FormGroup({method, info})` marked dirty; new contact child renders with `[init_method]` = first unused of `email/twitter/nostr` and `[focused]=true` |
| open contact method select | contact child mat-select | shows three options Email / X / Nostr; trigger renders selected option's icon + label |
| type into contact info | contact child info input | dirties the subgroup; chip count goes up |
| Enter in contact row | contact child form | `update(index)` → `onArrayControlUpdate('contact', i)` → blocked if duplicate methods, else `mint_contact_add` (new) or `mint_contact_update` (existing) |
| click delete on contact row | contact child mat-suffix | `remove(index)` → `onArrayControlRemove('contact', i)` |
| click MOTD area | motd child message-of-the-day pill | `onClick` focuses the textarea |
| type into MOTD | motd textarea | dirties `motd`; pill flips to `hot-motd`; chip count goes up |
| click MOTD delete | motd mat-suffix delete (only visible when `motd` is truthy) | `onDelete` clears form value to null AND emits `update` immediately → `mint_motd_update(null)` |
| confirm event chip | global `orc-event-general-nav-tool` | `EventService` flips `confirmed=true` → bulk `BulkMintUpdate` mutation covering all dirty fields |
| cancel event chip | global event chip | `confirmed=false` → walks every dirty control reverting to `init_info` (and removing newly-added array entries) |
| navigate away while PENDING | router | `canDeactivate()` returns false → router guard prompts (handled outside this component) |

## Test-author handoff

### Host page + setup

- Route to `goto('/mint/info')`.
- `beforeEach`: storageState (admin auth from existing `loginViaUi` infra in `e2e/helpers/`), then `page.goto('/mint/info')`, then `await expect(page.locator('orc-mint-subsection-info')).toBeVisible()`. Wait for `mat-card-content` inside the host as the settled signal — the form patches synchronously in `ngOnInit` so once the host mounts every child is populated.
- Tag: `@mint`. The render-only assertions are also good `@canary` candidates; the per-field save round-trip is the natural `@canary` smoke. Mutating tests (URL add / contact add / MOTD edit) should run last in their describe and revert via the chip's cancel path so they don't leak fixture state.

### Differential oracles

The mint daemon's NUT-06 `/v1/info` is the source of truth for every field on this page. There is no per-field helper today; the existing `mint.getInfo(config)` returns the parsed `MintNutInfo` and is sufficient.

| Form field | Oracle | Notes |
|---|---|---|
| `init_info.name` | `mint.getInfo(config).name` | NUT-06 `name`. |
| `init_info.description` | `mint.getInfo(config).description` | NUT-06 `description`. |
| `init_info.description_long` | `mint.getInfo(config).description_long` | NUT-06 `description_long`. |
| `init_info.icon_url` | `mint.getInfo(config).icon_url` | NUT-06 `icon_url`. |
| `init_info.motd` | `mint.getInfo(config).motd` | NUT-06 `motd`. |
| `init_info.urls` | `mint.getInfo(config).urls` | NUT-06 `urls[]`. Order matches what the daemon emits. |
| `init_info.contact` | `mint.getInfo(config).contact` | NUT-06 `contact[]` of `{method, info}`. |
| Per-field mutation persisted | re-call `mint.getInfo(config)` after the mutation completes; the `cached(...)` wrapper around `getInfo` keys on `config.name`, so call `mint.getInfo` afresh after a mutation — the helper memoises across calls, so any test that depends on the mutated value seeing the new oracle must invalidate the cache or read via a non-cached path. **Gap to fill**: `mint.getInfoFresh(config)` (or a `bust: true` flag on `getInfo`) before writing the persistence-round-trip test. |

### State reachability matrix

| State | `lnd-nutshell-sqlite` | `lnd-cdk-sqlite` | `cln-cdk-postgres` | `cln-nutshell-postgres` |
|---|---|---|---|---|
| 1. Pristine | ✓ live | ✓ live | ✓ live | ✓ live |
| 2. Single-field dirty | ✓ live (type into a field) | ✓ live | ✓ live | ✓ live |
| 3. Multi-field dirty | ✓ live | ✓ live | ✓ live | ✓ live |
| 4. Single-field save | ✓ live | ✓ live | ✓ live | ✓ live |
| 5. Bulk save | ✓ live | ✓ live | ✓ live | ✓ live |
| 6. Bulk cancel | ✓ live | ✓ live | ✓ live | ✓ live |
| 7. Saving (transient) | ✓ live (race against fast mutation) | ✓ live | ✓ live | ✓ live |
| 8. Invalid name (>200 chars) | ✓ live | ✓ live | ✓ live | ✓ live |
| 9. Duplicate contact methods | ✓ live | ✓ live | ✓ live | ✓ live |
| 10. Empty required URL/contact | ✓ live | ✓ live | ✓ live | ✓ live |
| 11. Mutation error | — disruptive (need to force a server error; `docker pause` mint daemon would knock out sibling specs) | — disruptive | — disruptive | — disruptive |
| 12. canDeactivate guard | ✓ live | ✓ live | ✓ live | ✓ live |
| 13. AI tool-call mutation | — synthetic (requires `ai_enabled=true` + a live model; flip the app setting via Karma instead) | — synthetic | — synthetic | — synthetic |
| 14a. Mobile padding/contact stack | ✓ live (set viewport to 600×900) | ✓ live | ✓ live | ✓ live |
| 14b. Tablet padding | ✓ live (set viewport to 900×1200) | ✓ live | ✓ live | ✓ live |
| 14c. Desktop padding | ✓ live (default viewport) | ✓ live | ✓ live | ✓ live |
| Icon child: unset | ✓ live (default fixture has no icon_url) | ✓ live | ✓ live | ✓ live |
| Icon child: loading (transient) | ✓ live (type a URL, screenshot during 500ms debounce window) | ✓ live | ✓ live | ✓ live |
| Icon child: set | ✓ live (paste a known-good image URL) | ✓ live | ✓ live | ✓ live |
| Icon child: error | ✓ live (paste a 404 / non-image URL) | ✓ live | ✓ live | ✓ live |
| URL child: tor icon | — synthetic (regtest never produces `.onion` URLs; type one to drive the icon) | — synthetic | — synthetic | — synthetic |
| URL child: vpn_lock_2 (https) | ✓ live (default fixture URL is `https://nut-sat-lite.cash`) | ✓ live | ✓ live | ✓ live |
| URL child: language (default) | ✓ live (type a non-https non-onion URL like `http://localhost`) | ✓ live | ✓ live | ✓ live |
| Contact child: email option selected | ✓ live (default fixture) | ✓ live | ✓ live | ✓ live |
| Contact child: twitter (X) option | ✓ live (open select, choose X) | ✓ live | ✓ live | ✓ live |
| Contact child: nostr option | ✓ live (open select, choose Nostr) | ✓ live | ✓ live | ✓ live |
| MOTD: unset | ✓ live (default fixture has null motd) | ✓ live | ✓ live | ✓ live |
| MOTD: set | ✓ live (after a save round-trip) | ✓ live | ✓ live | ✓ live |
| MOTD: hot | ✓ live (focus while editing) | ✓ live | ✓ live | ✓ live |

### Per-state probes

All locators verified live against the mounted page; each resolves to the expected element on the default fixture. Two notes:

- `orc-event-general-nav-tool` exists in *two* places in the DOM (one inside `orc-nav-primary-footer` for desktop sidenav, one inside `orc-nav-mobile` for the mobile bottom nav) — the visibility is mutually exclusive per viewport. Use `page.locator('orc-event-general-nav-tool').filter({has: page.locator(':scope:visible')}).first()` or simply `page.locator('orc-event-general-nav-tool:visible').first()` to pick the active one.
- A URL row contains four `mat-icon` instances (the leading address-type icon plus the trailing delete-suffix's icon, each potentially flanked by mat-error glyphs). The unique address-type icon is `orc-mint-subsection-info-form-url .flex-items-center > mat-icon.orc-outline-color`.

| State | Settled signal | Primary assert |
|---|---|---|
| Pristine | `host.locator('mat-card-content')` visible | `host.locator('orc-mint-subsection-info-form-name input').inputValue()` equals `mint.getInfo(config).name` |
| Single-field dirty | `host.locator('orc-mint-subsection-info-form-name .orc-hot-form-field')` visible | `page.locator('orc-event-general-nav-tool:visible').first()` text contains `1 update` |
| Multi-field dirty | both `orc-mint-subsection-info-form-name .orc-hot-form-field` and `orc-mint-subsection-info-form-description .orc-hot-form-field` visible | nav chip text contains `2 updates` |
| Single-field save (after Enter) | `nav` chip transitions PENDING → SAVING → SUCCESS ("Information updated!") | re-fetched `mint.getInfo(config).name` equals the new value |
| Bulk save | nav chip transitions PENDING → SAVING → SUCCESS | each dirty field's oracle equals its new value |
| Bulk cancel | nav chip clears | `host.locator('.orc-hot-form-field').count()` returns 0 |
| Saving (transient) | nav chip text contains `Saving` | (timing-sensitive; rely on `matchGql` to await `BulkMintUpdate` POST instead of polling DOM) |
| Invalid name | `host.locator('orc-mint-subsection-info-form-name mat-error')` visible | `nav` chip on bulk-confirm carries `Invalid info` warning |
| Duplicate contact methods | none — error event-chip renders | `nav` chip text contains `Contact method already set:` |
| Empty required URL | `host.locator('orc-mint-subsection-info-form-url mat-error')` visible after blur | bulk save short-circuits with WARNING `Invalid info` |
| Mutation error | nav chip type=ERROR | (skipped — see Skip taxonomy) |
| canDeactivate guard | `page.locator('orc-event-general-unsaved-dialog')` visible after `page.goto('/')` while PENDING | dialog renders; declining keeps URL on `/mint/info` |
| AI tool-call mutation | (skipped) | — |
| Mobile padding | `host.locator('.mint-subsection-info-container.p-1')` visible after `page.setViewportSize({width: 600, height: 900})` | `host.locator('orc-mint-subsection-info-form-motd mat-icon')` count is 0 (chat-bubble hidden on mobile) |
| Tablet padding | `host.locator('.mint-subsection-info-container.p-1')` visible at 900×1200 | MOTD chat-bubble icon visible (only mobile drops it) |
| Desktop padding | `host.locator('.mint-subsection-info-container.p-2')` visible at 1440×900 | MOTD chat-bubble icon visible |
| Icon: unset | `host.locator('orc-mint-subsection-info-form-icon .mint-info-icon-display.unset-icon')` visible | mat-icon `add_photo_alternate` rendered |
| Icon: loading | `host.locator('orc-mint-subsection-info-form-icon mat-spinner')` visible | (timing-sensitive — capture during 500ms debounce window) |
| Icon: set | `host.locator('orc-mint-subsection-info-form-icon img.mint-icon-url')` visible with non-empty `src` | image element rendered |
| Icon: error | `host.locator('orc-mint-subsection-info-form-icon .error-icon mat-icon')` visible (text "error") | control invalid; bulk save WARNING |
| URL: tor icon | `host.locator('orc-mint-subsection-info-form-url .flex-items-center > mat-icon.orc-outline-color[svgIcon="tor"]')` visible | (icon set once in `ngAfterViewInit` — mount with the `.onion` value already pushed; typing later does not refresh) |
| URL: vpn_lock_2 | `host.locator('orc-mint-subsection-info-form-url .flex-items-center > mat-icon.orc-outline-color')` text equals `vpn_lock_2` | default fixture |
| URL: language | `host.locator('orc-mint-subsection-info-form-url .flex-items-center > mat-icon.orc-outline-color')` text equals `language` | non-https non-onion URL |
| Contact: email selected | `host.locator('orc-mint-subsection-info-form-contact mat-select-trigger mat-icon')` text equals `mail` | trigger label reads `Email` |
| Contact: X selected | trigger contains `<mat-icon svgIcon="x">` | trigger label reads `X` |
| Contact: nostr selected | trigger contains `<mat-icon svgIcon="nostr">` | trigger label reads `Nostr` |
| MOTD: unset | `host.locator('orc-mint-subsection-info-form-motd .unset-motd')` visible | mat-icon `add_comment` rendered |
| MOTD: set | `host.locator('orc-mint-subsection-info-form-motd .set-motd')` visible | mat-icon `chat_bubble` rendered + delete-suffix button visible |
| MOTD: hot | `host.locator('orc-mint-subsection-info-form-motd .hot-motd')` visible | save / cancel suffixes visible via `orc-form-field-dynamic` |

### Reusable interaction recipes

- **Material text/textarea fill** — never `preview_fill` / Playwright `fill()` because `orc-form-field-dynamic`'s "hot" detection sometimes lags. Use Playwright's `locator.pressSequentially(value, {delay: 0})` after `locator.click()` so focus + input events fire the way ReactiveForms expects. Same recipe is in `mint-general-config.spec.ts`.
- **Material `<mat-select>` open + pick** — `locator.click()` on the select trigger, then `page.locator('.mat-mdc-select-panel mat-option', {hasText: 'X'}).click()`. Never `selectOption` — that's for native `<select>` only. See `mint-general-config.spec.ts` for an existing pattern.
- **Awaiting a single-field save round-trip** — combine a `matchGql` predicate on the matching mutation name (`mint_name_update`, `mint_short_description_update`, `mint_long_description_update`, `mint_icon_update`, `mint_motd_update`, `mint_url_add`, `mint_url_remove`, `mint_contact_add`, `mint_contact_remove`) with a wait on the SUCCESS event chip. See [`e2e/helpers/ui/gql-intercept.ts`](../../e2e/helpers/ui/gql-intercept.ts).
- **Awaiting a bulk save** — `matchGql` on `BulkMintUpdate` (the operation name baked into `onConfirmedEvent`).
- **Driving the global event chip** — `page.locator('orc-event-general-nav-tool')` then chip-confirm / chip-cancel locators. Identical recipe to other PENDING-flow specs (config / dashboard).
- **Viewport-driven device_type** — `page.setViewportSize({width, height})` then await one tick of the breakpoint observer (`page.waitForTimeout(50)` is enough; the cdk emits synchronously on resize). Avoid resizing mid-save — the breakpoint subscription does not interact with the form, but a viewport change after a focus can re-render the cancel suffix and steal focus.

### Skip taxonomy

- **State 11 — Mutation error**: `disruptive`. Forcing a server-side error from regtest requires either pausing the mint daemon (knocks out every other spec running against the same stack) or middleware injection (no infra). Cover via Karma — the `next/error` callback is already structurally-tested in `mint-subsection-info.component.spec.ts`.
- **State 13 — AI tool-call mutation**: `unit-better`. Requires `ai_enabled=true` plus a live model endpoint (no fixture for ollama responses), and the failure modes (tool name mismatch, missing argument, no-op when URL not in `init_info.urls`) are easier to assert in Karma against the parent's `executeAssistantFunction`.
- **Icon: loading**: `unit-better` (timing-sensitive 500ms debounce + 500ms image probe is racy in CI). Karma can drive `renderIconUrl` directly.
- **AI subscription wiring**: `unit-better` for the `ai_enabled` branching.
- **`canDeactivate` dialog interior**: `dead-branch` for *this* spec (the dialog UI lives in `event-general-unsaved-dialog`, which has its own spec). This spec asserts only that the guard returns false.
- **MOTD `setTimeout(autogrow.grow, 10)`**: `unit-better`. Asserting the textarea height delta after auto-grow is height-pixel-fragile.

## Test fidelity hooks

No e2e spec exists yet (`e2e/specs/mint-subsection-info.spec.ts` is the file this spec is the brief for). When written, it should at minimum cover:

- Pristine differential — every textbox value matches `mint.getInfo(config)`.
- Single-field save round-trip — edit name, Enter, expect SUCCESS chip + oracle-fresh-fetch matches the new value, then revert via a second save so the fixture is left clean.
- Multi-field bulk save round-trip via the chip confirm — at minimum description + MOTD; assert the single `BulkMintUpdate` GraphQL POST fires (not multiple per-field mutations) and that both fields persist.
- Bulk cancel — dirty two fields, dismiss the chip, assert no GraphQL mutation fired and both inputs reset to the oracle values.
- URL add → cancel via chip → assert nothing persisted; URL add → save → assert fixture URL list grew by one in the oracle, then cleanup-remove via per-row delete.
- Contact add/remove with method-select interaction — verify `init_method` defaults to the next unused of `email/twitter/nostr` when adding.
- Validation: name >200 chars blocks per-field save and yields `Invalid info` on bulk save.
- Validation: duplicate contact methods blocks save with `Contact method already set: <method>`.

States explicitly out of scope for the e2e (with Skip-taxonomy tags from §14):

- AI tool-call paths (`unit-better`).
- Icon `loading` transient state (`unit-better`).
- Mutation error chip (`disruptive`).
- `canDeactivate` dialog interior (`dead-branch` for this spec — owned by `event-general-unsaved-dialog`).
- MOTD autogrow geometry (`unit-better`).
- Per-stack URL `tor` icon (`synthetic` — requires typing a `.onion` URL; the icon is set once in `ngAfterViewInit` so the test must mount with the value already in `init_info.urls`, which regtest never produces).

## Notes for implementers

- `OnPush` + manual `cdr.detectChanges()` after every form mutation. The pattern is necessary because the dirty-count → event chip flow runs through an `Observable` boundary (`toObservable(dirty_count)`) that does not auto-trigger CD.
- The icon child's image probe uses `new Image(); img.src = url` with no abort — typing four URLs in 600ms leaves four pending loads. They each fire onload/onerror and each calls `cdr.detectChanges()`. Not a leak (each Image is GC'd) but a refactor target if the host page ever pre-fetches many icons.
- The bulk mutation in `onConfirmedEvent` builds GraphQL on the fly. Operation name is hard-coded `BulkMintUpdate`; aliases follow the pattern `url_remove_<i>` / `url_add_<i>` / `contact_remove_<i>` / `contact_add_<i>`. Test fixtures asserting on the request body should match by alias prefix, not exact request shape.
- `evaluateDirtyCount` walks `Object.keys(form_info.controls)` and re-runs every value-change tick; in practice the form has 7 top-level keys + 2 arrays so the loop is cheap. If a future field is added, no other code needs touching — the count derives from `form_info.controls` directly.
- The per-field `update*` methods all call `mintService.clearInfoCache()` + `loadMintInfo()` in `onSuccess`. Other components on the page that subscribe to `mintService.getMintInfo()` will refetch automatically; this is why the side-nav avatar updates after an icon change without an explicit emit.
- Typo-watch: `contrtol_count` in `evaluateDirtyCount` ([line 208](../../src/client/modules/mint/modules/mint-subsection-info/components/mint-subsection-info/mint-subsection-info.component.ts#L208)) is a typo of `control_count` — fix opportunistically when next editing the file.
