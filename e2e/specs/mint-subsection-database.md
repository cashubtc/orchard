# `orc-mint-subsection-database`

Source: [mint-subsection-database.component.ts](../../src/client/modules/mint/modules/mint-subsection-database/components/mint-subsection-database/mint-subsection-database.component.ts) · [`.html`](../../src/client/modules/mint/modules/mint-subsection-database/components/mint-subsection-database/mint-subsection-database.component.html)

## Purpose

The **Database** subsection page at `/mint/database`. Owns three concerns under one host:

1. A **filterable, paginated browser** over the mint daemon's mint-quotes / melt-quotes / swaps tables (control + chart + table children).
2. An **offline backup workflow** — `Create Backup` opens a child form, the global event chip's `Save` fires the `mint_database_backup` mutation, and on success the parent decodes the base64 payload into a `Blob` and triggers a synthetic `<a download>` click.
3. An **offline restore workflow** — `Restore Backup` opens a file-picker child, the user selects a `.db` / `.sqlite` / `.sql` / `.backup` file, the child base64-encodes it via `FileReader`, and the chip's `Save` fires the `mint_database_restore` mutation. The mutation atomically replaces the mint daemon's database file (sqlite) or `pg_restore`s into the database (postgres).

The component is `OnPush`, runs `cdr.detectChanges()` after every async hop, registers a `canDeactivate()` guard that returns false when an event is `PENDING`, and tears down its subscriptions in `ngOnDestroy`.

This spec scopes the e2e coverage to the **backup-critical surface only** — filters / chart / table / quote-paid dialog are documented for completeness but tagged `unit-better` or `out-of-scope` in the test-author handoff (§14).

## Where it renders

- **Only usage**: route `/mint/database`, lazy-loaded via `OrcMintSubsectionDatabaseModule` from [mint-section.module.ts:194-208](../../src/client/modules/mint/modules/mint-section/mint-section.module.ts#L194). Gated by `enabledGuard` (mint feature must be enabled in runtime config). Route data: `mint_keysets: MintKeyset[]` (resolver) + `sub_section: 'database'` + `assistant: AiAssistant.MintDatabase`.
- The child route is wrapped by `pendingEventGuard` ([mint-subsection-database.module.ts:69](../../src/client/modules/mint/modules/mint-subsection-database/mint-subsection-database.module.ts#L69)) — leaving the page while a `PENDING` event is active prompts the unsaved-work dialog.

## Inputs

This component takes no `@Input()`s — it is a routed page. The state surface comes from route data, services, and saved per-device settings:

| Source | Type | Where it ends up | Notes |
|---|---|---|---|
| `route.data.mint_keysets` | `MintKeyset[]` | `mint_keysets` | Server-side resolver hits `mint_keysets` GraphQL query; used to derive `unit_options`, `mint_genesis_time`, and `MintDataType.MintMints` default state. |
| `SettingDeviceService.getMintDatabaseSettings()` | `NonNullableMintDatabaseSettings` | `page_settings` | Per-device persisted filter state: `type`, `date_start`, `date_end`, `date_preset`, `page`, `page_size`, `units[]`, `states[]`. |
| `ConfigService.config.mint.database_type` | `'sqlite' \| 'postgres'` | `database_implementation` | Drives the backup filename extension (`.db` for sqlite, `.sql` for postgres) — read inside `getDefaultFilename()`. |
| `ConfigService.config.lightning.enabled` | `boolean` | `lightning_enabled` | Gates `getLightningRequest()` enrichment in `onMoreRequest()`; backup/restore flow does not depend on it. |
| `SettingAppService.getSetting('ai_enabled').value` | `boolean` | gated subscriptions | Adds the assistant + tool-call subscriptions when true. The `MintBackup` assistant context (mint version, timestamp, implementation, filename) is hired during `CREATE` mode. |
| `SettingAppService.getSetting('bitcoin_oracle').value` | `boolean` | `bitcoin_oracle_enabled` | Unrelated to backup/restore; oracle conversion only fires for table row "more" requests. |
| `route.data.mint_info` (via `loadMintInfo`) | `MintInfo` | `database_version` (`{version, replace(/\//g, '-')}`) | Lazily loaded by `getDefaultFilename()` when the user opens the backup form, NOT at mount. |
| `EventService.getActiveEvent()` | `EventData \| null` | `active_event` | The global event-chip stream. Drives the parent's confirm/cancel state machine for both forms. |
| `BreakpointObserver` | `BreakpointState` | `device_type` signal | XSmall → `mobile`, Small\|Medium → `tablet`, else `desktop`. |

## Outputs & projected content

- No `@Output()`s — this is a top-level routed page.
- No `<ng-content>` slots in the parent template. Two `#backup_form` / `#restore_form` `ElementRef` anchors exist purely so `initCreateBackup()` / `initRestoreBackup()` can `scrollIntoView({behavior: 'smooth'})` the corresponding form into view when the user opens it.

## Derived / computed signals

The parent intentionally keeps minimal reactive state — most rendering logic lives in children.

- `device_type` → `'desktop' \| 'tablet' \| 'mobile'`. Set by `BreakpointObserver`. Drives the `@switch` on the backup-action FAB:
  - `desktop` → extended FAB with `database` icon + "Create Backup" label
  - `tablet` → icon-only FAB
  - `mobile` → no FAB; `Create Backup` is added as the first item in the `more_vert` menu
- `bitcoin_oracle_data` → `{price_cents, date} | null`. Out-of-scope for backup/restore; populated only when a table row's `onMoreRequest` runs through `calculateBitcoinOraclePrice`.
- `highlighted_entity_id` → `string | null`. Driven by table row hover. Out-of-scope for backup/restore.
- `state_enabled` (getter, not a signal) → `true` when `data.type` is `MintMints` or `MintMelts` (states control is hidden on the swaps tab). Out-of-scope for backup/restore.

There is no parent-level computed for `form_mode` — it is a plain `FormMode | null` field (`'CREATE' | 'RESTORE' | null`). Re-renders rely on `cdr.detectChanges()` calls scattered through the form lifecycle methods.

## Happy path (backup)

1. Router resolves `mint_keysets`. `ngOnInit` hydrates `page_settings`, the breakpoint observer, the event subscription, the form-restore valueChanges subscription, and (if `ai_enabled`) the assistant subscriptions. The `form_backup` and `form_restore` `FormGroup`s mount empty.
2. The control row mounts: `orc-mint-subsection-database-control` + the action cluster (FAB or menu) + `more_vert`. Both collapsibles (`.orc-animation-collapsible`) start closed (no `.animation-open`). The chart and table mount cold, populated by the initial `getDynamicData()` async hop.
3. User clicks **Create Backup** (desktop/tablet FAB or mobile menu item) → `onCreate()` → `initCreateBackup()`:
   - `form_mode = 'CREATE'`
   - `EventService.registerEvent({type: 'PENDING', message: 'Save'})` → global chip flips to "Save" with confirm/cancel suffixes
   - `backup_form` ref's `scrollIntoView({behavior: 'smooth', block: 'start'})` lifts the form into view
   - `getDefaultFilename()` calls `mintService.loadMintInfo()`. On response, `database_version` is set to `mint_info.version.replace(/\//g, '-')`, `database_timestamp` to `DateTime.now().toUnixInteger()`, `database_implementation` to the runtime config's `database_type`. The default filename is patched into the `filename` `FormControl`:
     `MintDatabaseBackup-{version}-{yyyyMMdd-HHmmss}.{db|sql}`
   - `.orc-animation-collapsible.animation-open` flips on for the backup collapsible; the restore collapsible stays closed.
4. The user can edit the filename or accept the default. The filename `FormControl` enforces `Validators.required` + `Validators.maxLength(1000)`.
5. User clicks **Save** on the chip (the global ribbon, not the form itself) → `EventService` flips the `PENDING` event's `confirmed` to `true` → `eventReaction()` → `eventCreateConfirmed()`:
   - if `form_backup.invalid` → emits `WARNING` event (`Invalid filename`), no mutation
   - else emits `SAVING` event → calls `mintService.createMintDatabaseBackup()` → on success caches `response.mint_database_backup.filebase64` into `backup_encoded` and emits `SUCCESS` event (`Backup created!`)
   - on error emits `ERROR` event with `errors[0].getFullError()`

   Note: the backup mutation does NOT go through the mint daemon. Orchard reads the DB directly — sqlite via `better-sqlite3`'s online-backup API ([`createBackupSqlite`](../../src/server/modules/cashu/mintdb/cashumintdb.service.ts#L249)), postgres via `pg_dump` against the configured connection string. The daemon's running state is irrelevant to the mutation itself; it is only relevant to `loadMintInfo()` (called at form-open to populate the filename).
6. `eventReaction` re-fires for the `SUCCESS` event → `eventCreateSuccess()`:
   - `atob(this.backup_encoded)` → `Uint8Array` → `new File([...], filename, {type: 'application/octet-stream'})`
   - `URL.createObjectURL(file)` → synthetic `<a>` element with `href` + `download` → `a.click()` → browser save-as
   - `form_mode = null`, `backup_encoded = ''`, `cdr.detectChanges()`
7. The global chip clears (next `null` event tick). The backup collapsible animates closed.

## Happy path (restore)

1. From the default mounted state, the user opens the `more_vert` menu and clicks **Restore Backup** → `onRestore()` → `initRestoreBackup()`:
   - `form_mode = 'RESTORE'`
   - `restore_form` ref's `scrollIntoView` lifts the form into view
   - the restore collapsible flips to `.animation-open`
   - the global chip stays empty until the form goes dirty (registration is in the form-valueChanges subscription, not in `initRestoreBackup`)
2. User clicks **Select Backup** → triggers the hidden `<input type="file" accept=".db,.sqlite,.sql,.backup">` click → native file dialog → user picks a backup file.
3. `onFileSelected($event)` patches `form_restore.file` with the `File` and calls `readFileContent()`:
   - `file_loading.set(0)` → progress shimmer
   - `FileReader.onprogress` → `file_loading.set(percentage)` for each chunk
   - `FileReader.onload` → `file_loading.set(100)`, splits the data-URL on `,` to extract the base64 payload, patches `filebase64` into the form
   - the database icon flips from `file-not-ready` (greyed) to `file-ready` (tinted), and the file metadata block (filename, last-modified, size) un-`invisible`s.
4. The form-valueChanges subscription fires (because `form_restore` is now dirty) → `EventService.registerEvent({type: 'PENDING', message: 'Restore'})` → global chip becomes "Restore" with confirm/cancel.
5. User clicks **Save** on the chip → `eventReaction()` → `eventRestoreConfirmed()`:
   - if `form_restore.invalid` → `WARNING` event (`Invalid backup file`), no mutation
   - else `SAVING` event → `mintService.restoreMintDatabaseBackup(filebase64)` → on success `SUCCESS` event (`Backup restored!`)
   - on error `ERROR` event
6. `eventRestoreSuccess()` clears `form_mode`, resets `form_restore`, and runs `getDynamicData()` to refresh the chart/table from the (newly-restored) database.

## Reachable states

### 1. Default — both forms closed

Mounted with `form_mode === null`. Both `.orc-animation-collapsible` blocks lack `.animation-open`; the backup and restore children are still in the DOM but visually collapsed (CSS `max-height: 0` + `overflow: hidden`).

- Action cluster on the right of the control row (per `device_type()`):
  - `desktop` → extended FAB labelled `database Create Backup` + adjacent `more_vert` icon button
  - `tablet` → icon-only FAB (`database`) + `more_vert`
  - `mobile` → only `more_vert` (the menu carries `Create Backup`)
- Live default on `lnd-nutshell-sqlite`: `database_implementation = 'sqlite'`, `database_version = 'Nutshell-0.20.0'`, table populated with the seeded mint quotes (5 rows on the canary fixture).

### 2. `more_vert` menu open

Click the trailing icon button. Items returned by the overlay depend on `device_type()`:

- `desktop` / `tablet`: `restore Restore Backup`, `refresh Refresh Data` (Create lives in the FAB)
- `mobile`: `database Create Backup`, `restore Restore Backup`, `refresh Refresh Data`

The menu has class `orc-sticky-menu orc-more-menu` and yPosition `below`.

### 3. Backup form open (`form_mode === 'CREATE'`)

Triggered by `onCreate()`. The backup collapsible flips `.animation-open`. The global event chip switches to a `Save` PENDING ribbon (registered synchronously in `initCreateBackup`).

- `mint_database_form-backup` shows:
  - File-name `mat-form-field` (orc-hot variant) pre-populated with the default filename (e.g. `MintDatabaseBackup-Nutshell-0.20.0-20260507-231854.db` on `lnd-nutshell-sqlite`)
  - Database glyph + 3-row meta block: `Database: sqlite`, `Version: Nutshell-0.20.0`, `Timestamp: May 7, 2026, 11:18:54 PM`
  - Close (✕) icon button at top-right → `close.emit()` → parent `onClose()` → resets and clears chip
- The shimmer placeholders in the meta block render only when `database_implementation` / `database_version` / `database_timestamp` are not all truthy — i.e. the brief window before `loadMintInfo()` resolves. On a healthy daemon this is sub-second.

### 4. Backup form — invalid filename

Clear the filename field (or paste >1000 chars). `form_backup.invalid === true`. Pressing Save on the chip routes through `eventCreateConfirmed`, hits the early `if (this.form_backup.invalid)` branch, and emits a `WARNING` event (`Invalid filename`). The chip flips to `WARNING`, the form stays open, the user fixes and re-saves.

### 5. Backup save in flight (`SAVING`)

Between the chip confirm and the mutation response, the event chip shows the `SAVING` state. The form is non-interactive while the save is pending (no internal disabled handling in the parent — relies on the chip lock).

### 6. Backup success → file download

`eventCreateSuccess()` decodes the base64 payload, builds a `File`, creates an object URL, synthesises an `<a download>`, and `.click()`s it. No DOM mutation persists (the anchor is created and discarded inside the function). `form_mode` returns to `null`, the collapsible animates closed, and the chip clears.

### 7. Backup error

Mutation rejects → `eventCreateConfirmed` error branch emits `ERROR` with `errors[0].getFullError()`. `eventReaction` then routes through `eventError()`, which clears `form_mode`, resets both forms, and runs `cdr.detectChanges()`. The chip displays the error message, the user is bounced back to the default state.

### 8. Restore form open (`form_mode === 'RESTORE'`)

Triggered by `onRestore()`. The restore collapsible flips `.animation-open`. The chip is **not** registered until the form goes dirty (i.e. the user picks a file).

- `mint_database_form-restore` shows:
  - `Select Backup` stroked button (triggers the hidden file input on click)
  - Database glyph initially `file-not-ready` (`mat-icon.icon-lg.file-not-ready`)
  - Metadata column hidden via `.invisible`
  - Help-text block "Restoring from backup" with a 4-step ordered list:
    1. **Shut down the mint** *(orange `orc-status-warning-color`)*
    2. Select a backup file (match current mint version)
    3. Restore the backup
    4. Start the mint
  - Close (✕) icon button at top-right.

### 9. Restore form — file loading

`file_loading()` is between 0 and 99. The database glyph stays `file-not-ready`; the metadata column stays `.invisible`. `file_quorum` getter returns false because the loading is mid-flight.

### 10. Restore form — file ready (`file_quorum === true`)

`file_loading()` is `null` (load complete) or `100`, AND `file` is non-null. The database glyph flips to `file-ready` (tinted via the `file-ready` class). The metadata column un-`invisible`s, showing:

- File: `{file.name}`
- Last Modified: `{file.lastModified / 1000 | localTime: 'medium'}` (e.g. `Apr 24, 2024, 5:06:40 PM`)
- Size: `{file.size | dataBytes}` (e.g. `16 B`, `34.43 kB`)

The form-valueChanges subscription has fired → global chip is showing `Restore` PENDING.

### 11. Restore save in flight / success / error

Symmetrical to backup states 5–7 but for the `mint_database_restore` mutation:

- `SAVING` chip while the mutation is pending
- `SUCCESS` (`Backup restored!`) → `eventRestoreSuccess()` clears `form_mode`, resets `form_restore`, runs `getDynamicData()` (chart + table re-mount with the restored data), `cdr.detectChanges()`
- `ERROR` → `eventError()` clears `form_mode` and resets both forms

The mutation is **destructive** on the daemon end: sqlite path overwrites `cashu.database` on disk; postgres path runs `pg_restore --clean --if-exists` against the configured connection string. There is no transactional rollback on the orchard side.

The restore mutation, like backup, does NOT go through the mint daemon. Orchard rewrites the DB file directly. The daemon's own help text still says *"Shut down the mint"* before restoring because the daemon may hold an open file descriptor on the sqlite inode (or open postgres transactions) that diverges from on-disk state until restart. For e2e the test must `docker stop` the mint container before submitting restore and `docker start` it afterwards — not because the mutation needs the daemon down to succeed, but because the daemon's post-restore behavior is undefined unless restarted.

### 12. Both collapsibles toggling

Re-clicking `Create Backup` while the backup form is open calls `onCreate()` which routes through `onClose()` (because `form_mode === 'CREATE'` already). Same for restore. The two flows are mutually exclusive in the state machine — opening one while the other is open closes the first via `onClose()` only when the user clicks the same trigger; clicking the *other* trigger does NOT close the open form, it just sets `form_mode` to the new mode and the previous collapsible flips to `.animation-open === false` while the new one opens.

### 13. Pending-event guard interception

If the user has the chip in a `PENDING` (or `SAVING`) state and tries to navigate away via the side nav, the route's `pendingEventGuard` consults the component's `canDeactivate()` (which returns false when `active_event?.type === 'PENDING'`) and triggers the unsaved-work dialog. Out-of-scope for the backup spec; tested separately.

## Child components

### `orc-mint-subsection-database-form-backup`

Source: [mint-subsection-database-form-backup.component.ts](../../src/client/modules/mint/modules/mint-subsection-database/components/mint-subsection-database-form-backup/mint-subsection-database-form-backup.component.ts) · [`.html`](../../src/client/modules/mint/modules/mint-subsection-database/components/mint-subsection-database-form-backup/mint-subsection-database-form-backup.component.html)

Pure presentational form — no service calls, no internal mutations.

#### Parent → child data contract

| Input | Type | Source | Notes |
|---|---|---|---|
| `active` | `boolean` | `form_mode === 'CREATE'` | Drives nothing in the child template currently, but reserved as a hook (the child binds it but doesn't consume it). |
| `form_group` | `FormGroup` | parent's `form_backup` (`{filename: FormControl(null, [required, maxLength(1000)])}`) | The single source of truth for the filename input. |
| `database_version` | `string` | parent's `getDefaultFilename` after `loadMintInfo` resolves | e.g. `Nutshell-0.20.0`. Slashes already replaced with hyphens. |
| `database_timestamp` | `number` | parent's `DateTime.now().toUnixInteger()` at form-open time | Unix seconds. Rendered with `localTime: 'medium'`. |
| `database_implementation` | `string` | parent's `configService.config.mint.database_type` | `'sqlite'` or `'postgres'`. |

#### Child outputs

- `close: void` — emitted from the top-right icon button. Parent runs `onClose()` (resets the form, clears chip, sets `form_mode = null`).

#### Child reachable states

##### `meta loading` (shimmer)

Initial render before `loadMintInfo()` resolves. The `@if (database_implementation() && database_version() && database_timestamp())` guard fails → 3 shimmering corner-full bars render in the meta column. Sub-second on a healthy daemon; effectively never observed in steady-state e2e.

##### `meta populated`

All three meta inputs are truthy. Database / Version / Timestamp render with their values.

##### `filename empty / required error`

The `mat-error` block hosts `<orc-form-error>` reading `form_group().get('filename')?.errors`. With the filename cleared, `errors.required === true` → the form-error pipe writes `Invalid` (the literal label, the orc-form-error component does the messaging — see its own spec for which validator code maps to which copy).

##### `filename valid`

Default. The mat-error is suppressed. The `orc-hot-form-field` styling stays "hot" because the field has no special pristine/dirty handling — the parent's hot-form CSS keeps it always-hot once active.

#### Child interactions

| Gesture | Target | Result |
|---|---|---|
| type into filename | `input[formControlName="filename"]` | updates `form_backup.filename` value; validator runs |
| Enter while focused | `<form>` | suppressed via `(keydown.enter)="$event.preventDefault()"` and form `(ngSubmit)="$event.preventDefault()"` — Save MUST go through the chip |
| click ✕ | top-right `mat-icon-button` | emits `close` → parent `onClose()` |

### `orc-mint-subsection-database-form-restore`

Source: [mint-subsection-database-form-restore.component.ts](../../src/client/modules/mint/modules/mint-subsection-database/components/mint-subsection-database-form-restore/mint-subsection-database-form-restore.component.ts) · [`.html`](../../src/client/modules/mint/modules/mint-subsection-database/components/mint-subsection-database-form-restore/mint-subsection-database-form-restore.component.html)

Owns the file-picker, FileReader, and base64 encoding. Still uses the legacy `@Input()` decorator (not `input.required()` like the backup child).

#### Parent → child data contract

| Input | Type | Source | Notes |
|---|---|---|---|
| `active` | `boolean` | `form_mode === 'RESTORE'` | Bound but not consumed by the template. |
| `form_group` | `FormGroup` | parent's `form_restore` (`{file: FormControl(null, [required]), filebase64: FormControl(null, [required])}`) | `file` holds the `File` object; `filebase64` holds the base64 payload string. |

#### Child outputs

- `close: void` — top-right icon button. Same handler as the backup child.

#### Child internal state

- `file_loading: signal<number | null>(null)` — `null` = idle, `0..99` = reading, `100` = done. Transitions: `null → 0 → ... → 100 → null`-on-error.
- `file_quorum: getter` — `true` when:
  - `file_loading() === null` OR `file_loading() === 100`, AND
  - `form_group.get('file')?.value !== null`

#### Child reachable states

##### `idle / no file selected`

Initial mount. `file_loading() === null`, `form_group.file === null`. The database glyph has `file-not-ready` class (greyed). The metadata column has `.invisible` so it occupies space but doesn't render content.

##### `reading file`

`file_loading()` is between `0` and `99`. The glyph stays `file-not-ready`. The metadata column stays `.invisible`. There is no progress bar — the only progress signal is `file_loading()` itself, which is not currently bound to any visible element. (Treat this as a "synthetic" state: visually identical to `idle` while reading.)

##### `file read complete`

`file_loading() === 100` → `file_quorum === true`. Glyph flips `file-ready` (tinted). The metadata column un-`invisible`s, rendering:

- `File: {form_group.file.name}`
- `Last Modified: {form_group.file.lastModified / 1000 | localTime: 'medium'}`
- `Size: {form_group.file.size | dataBytes}`

The `filebase64` `FormControl` is also populated by this point (set in `onload`), satisfying `form_group.valid`.

##### `file read error`

`reader.onerror` → `file_loading.set(null)`. The form is left with the `File` object but no `filebase64`. The glyph stays `file-not-ready`. `file_quorum` is true (because `file !== null` and `file_loading === null`), but `form_group.invalid` is also true (because `filebase64` is `required`). This is a divergent state: the icon shows ready but Save will be blocked by the validity check. Worth a unit test; not worth synthesising in e2e.

##### `file replaced`

The user re-clicks `Select Backup` while a file is already present. The native dialog re-opens. On cancel nothing changes. On selection, the form patch overwrites both controls and `readFileContent()` runs again from `0`.

#### Child interactions

| Gesture | Target | Result |
|---|---|---|
| click `Select Backup` | `button[mat-stroked-button]` | calls `fileInput.click()` on the hidden `<input type=file>` → native picker |
| pick a file in the picker | hidden `input[type=file]` | `change` event → `onFileSelected` → `markAsTouched`/`markAsDirty` on `file` control → `readFileContent` |
| click ✕ | top-right `mat-icon-button` | emits `close` → parent `onClose()` (resets both forms, clears chip) |

The hidden file input's `accept` attribute is `.db,.sqlite,.sql,.backup`. This is an OS-level filter only — non-matching files can still be force-selected via "All files" in most pickers, and the daemon will reject invalid SQLite payloads with `OrchardErrorCode.MintDatabaseRestoreInvalidError` (sqlite path) or a `pg_restore` exit code (postgres path).

#### How the children close + what propagates back

Both children emit `close` to the parent. The parent's `onClose()`:

- resets `form_backup` AND `form_restore` (regardless of which child emitted)
- sets `form_mode = null`
- emits `EventService.registerEvent(null)` → global chip clears
- calls `cdr.detectChanges()`

The collapsible's CSS animation handles the visual fold. Children persist in the DOM after close (the `*ngIf` is on the collapsible-open state, not the child mount).

### Other peripheral children (not in scope for this spec)

These mount on the same page but are documented elsewhere or out-of-scope for the backup feature:

- `orc-mint-subsection-database-control` — filter ribbon (date range, type select, units, states, search). Tested in a sibling spec.
- `orc-mint-subsection-database-chart` — chart of the filtered dataset. Pure presentation.
- `orc-mint-subsection-database-table` + nested table-mint / table-melt / table-swap rows + `orc-mint-subsection-database-dialog-quote` — quote browser and the "set state PAID" dialog. Drives `onMoreRequest` and `onSetQuoteStatePaid`. Unrelated to backup/restore.

## Unhappy / edge cases

- **`loadMintInfo` rejects** — `getDefaultFilename` swallows nothing; the inner subscribe has no error handler, so an unhandled rejection logs to the console and `database_version` / `database_timestamp` / `database_implementation` stay `undefined`. The backup form's meta block stays in shimmer state. The filename field stays empty. `Save` is blocked by the `required` validator. Real-world this only happens when the mint daemon is down — and in that case `createMintDatabaseBackup` would also fail.
- **`mint_info.version` contains `/`** — `replace(/\//g, '-')` catches it; e.g. `cdk/0.10.0` becomes `cdk-0.10.0`. Filename is filesystem-safe.
- **Filename with path separators** — no validator strips `/` or `\`. `form_backup.filename = '../etc/passwd'` would round-trip into the `<a download>` attribute, but browsers sanitise download filenames and strip path components, so this is a non-issue in practice.
- **Filename >1000 chars** — `Validators.maxLength(1000)` rejects. The mat-error reads "Invalid". Save is blocked via `eventCreateConfirmed`'s `form_backup.invalid` early-return.
- **`backup_encoded` empty when SUCCESS fires** — would only happen if a different code path emitted SUCCESS without populating it. `eventCreateSuccess` runs `atob('')` → empty Uint8Array → empty File downloads. Not catastrophic; the user gets a 0-byte file. Not currently reachable through the UI.
- **Restore file >100MB** — no client-side size cap. `FileReader.readAsDataURL` will load the whole thing into memory. Browser tab can OOM on extremely large dumps. The mint daemon side caps via `Base64` scalar parsing; very large payloads will fail at the GraphQL boundary with a payload-size error.
- **Restore file is a malformed SQLite header** — sqlite path: `validateSqliteFile` in the server returns false → `MintDatabaseRestoreInvalidError`. The orchard error is surfaced to the chip as `Invalid file: Not a valid SQLite database` (rough phrasing — see `error.types.ts` for the exact mapping). The original DB is still on disk because the `unlink` happens *after* validation passes.
- **Restore against a postgres stack with a sqlite backup (or vice versa)** — `pg_restore` will choke on the SQLite header bytes and return non-zero; `MintDatabaseRestoreError` propagates. SQLite path will reject the postgres `pg_dump` text via the validator. No attempt is made to detect the cross-implementation mismatch on the client.
- **Restore in flight, user reloads the tab** — the `canDeactivate` guard's `beforeunload` does not show a dialog (per `AGENTS.md` self-hosted FOSS posture: orchard cannot block beforeunload reliably across all browsers). The mutation is fire-and-forget from the client; the daemon may finish the restore independently. Document, do not test.
- **`device_type` toggling mid-flow** — the `@switch` re-evaluates each change-detection tick; if the user resizes from desktop to mobile while the backup form is open, the FAB disappears and `Create Backup` migrates into the menu, but the form stays open and the chip stays active. No state corruption.
- **AI tool call `MintBackupFilenameUpdate` overrides user-typed filename** — `executeAssistantFunction` does a blind `patchValue({filename})` without dirty-checking the user's edit. The user's typed filename is silently replaced. Documented as a known asymmetry.

## Template structure (at a glance)

```
.mint-subsection-database-container [p-h-1]
├── .mint-database-control [p-t-1]
│   ├── flex row (justify-between)
│   │   ├── orc-mint-subsection-database-control [flex-grow]
│   │   └── action-cluster
│   │       ├── @switch device_type
│   │       │   ├── desktop → button[matFab][extended] "database Create Backup"
│   │       │   ├── tablet  → button[matFab] "database"
│   │       │   └── mobile  → (nothing — moved to menu)
│   │       └── button[mat-icon-button][matMenuTriggerFor="advanced_menu"] "more_vert"
│   ├── mat-menu#advanced_menu
│   │   ├── @if mobile → "database Create Backup"
│   │   ├── "restore Restore Backup"
│   │   └── "refresh Refresh Data"
│   └── .category-rule
├── .orc-animation-collapsible [.animation-open if form_mode==='CREATE']
│   └── orc-mint-subsection-database-form-backup
├── .orc-animation-collapsible [.animation-open if form_mode==='RESTORE']
│   └── orc-mint-subsection-database-form-restore
├── orc-mint-subsection-database-chart
└── .mint-data-table mat-card
    ├── orc-mint-subsection-database-table
    ├── @if (no data) .no-data-overlay
    └── .data-table-sticky-footer mat-paginator
```

## Interaction summary

| Gesture | Target | Result |
|---|---|---|
| click **Create Backup** FAB *(desktop/tablet)* | `button[matFab][extended]` (or icon-only on tablet) | `onCreate()` → opens backup collapsible, registers PENDING `Save` chip, scrolls form into view, fetches default filename |
| click **Create Backup** menu item *(mobile)* | menu item `database Create Backup` | same as above |
| click **Restore Backup** menu item | menu item `restore Restore Backup` | `onRestore()` → opens restore collapsible, scrolls form into view |
| click **Refresh Data** menu item | menu item `refresh Refresh Data` | `onRefresh()` → `reloadDynamicData()` |
| click ✕ on backup form | `orc-mint-subsection-database-form-backup` close button | child emits `close` → parent `onClose()` |
| edit filename | `input[formControlName="filename"]` *(inside backup child)* | dirties `form_backup.filename`; `Validators.maxLength(1000)` runs |
| click chip **Save** *(while CREATE)* | global event chip (lives on the page chrome, not in this component) | `eventCreateConfirmed` → `mintService.createMintDatabaseBackup()` → SUCCESS triggers `eventCreateSuccess` → synthetic `<a download>` click |
| click chip **Cancel** *(while CREATE or RESTORE)* | global event chip | parent `onClose()` |
| click ✕ on restore form | `orc-mint-subsection-database-form-restore` close button | same `onClose()` route |
| click **Select Backup** | `button[mat-stroked-button]` *(inside restore child)* | triggers hidden `<input type="file">` click → native picker |
| pick a file | hidden `input[type="file"]` *(inside restore child)* | `onFileSelected` → `readFileContent` → eventually `file_quorum=true` + chip = `Restore` |
| click chip **Save** *(while RESTORE)* | global event chip | `eventRestoreConfirmed` → `mintService.restoreMintDatabaseBackup(filebase64)` → SUCCESS triggers `eventRestoreSuccess` → reloads chart/table |
| (out-of-scope) date range / type / units / states / search / sort / paginate | `orc-mint-subsection-database-control`, `mat-paginator` | filter the chart/table |
| (out-of-scope) click row → "more" | table row | `onMoreRequest` → enriches with lightning request (if enabled) and oracle price (if enabled) |
| (out-of-scope) click "Mark PAID" | quote row | `onSetQuoteStatePaid` → opens `orc-mint-subsection-database-dialog-quote` confirm dialog |

## Test-author handoff

### Host page + setup

- **Route**: `/mint/database`
- **`beforeEach`**: `loginViaUi(page, getConfig(testInfo.project.name))` (or storageState if/when available for this project) → `page.goto('/mint/database', {waitUntil: 'networkidle'})`. Wait for the host: `await expect(page.locator('orc-mint-subsection-database')).toBeVisible()`.
- **Tag**: `@mint` (this is a mint subsection). Add `@canary` for the single most-critical assertion if it's part of the smoke set — recommendation: tag the "Create Backup → download" round-trip as `@canary` because it exercises the full backup mutation pipe and the file-download synthesis.
- **Worker mode**: `workers: 1` per project (already enforced) means specs in the same project serialize. The restore round-trip must run as a **single sequenced test**: backup → `docker stop` mint → restore → `docker start` mint → wait for healthcheck → assert. The backup *produces* the file the restore *consumes*; no fixture needs to be checked in. Other specs in the same project run before or after, never during, so the brief mint-down window is invisible to them.

### Differential oracles

| Input | Backend helper | Notes |
|---|---|---|
| `database_version` (e.g. `Nutshell-0.20.0`) | **gap** — no helper. `mint.getInfo(config).version` returns the NUT-06 version (`Nutshell/0.20.0`) which is the same string before the `/`-to-`-` replace. Either reuse `mint.getInfo` and apply `.replace(/\//g, '-')` test-side, or add `mint.getDatabaseImplementation(config)` returning `{version, type}` derived from the existing `getInfo` + config. |
| `database_implementation` (`'sqlite' \| 'postgres'`) | derive from `getConfig(projectName).db` — the [`ConfigInfo`](../../e2e/types/config.ts) carries `db` already. No helper call needed. |
| backup filename format (`MintDatabaseBackup-{version}-{yyyyMMdd-HHmmss}.{db\|sql}`) | constructible test-side from the two values above + `Date.now()`. The seconds-resolution timestamp will drift between the test's read and the form open, so assert with a regex (`MintDatabaseBackup-Nutshell-0\.20\.0-\d{8}-\d{6}\.db`) not equality. |
| backup mutation success → file download | Playwright `page.waitForEvent('download')` to catch the synthetic `<a download>` click. Assert `download.suggestedFilename().endsWith('.db')` (sqlite) / `.sql` (postgres). |
| restored database content | **gap** — no `mint.snapshotDatabase` helper. Out-of-scope for this spec; if added later, would need to checksum the sqlite file via `docker exec` against `cashu.database` path. |

### State reachability matrix

| State | `lnd-nutshell-sqlite` | `lnd-cdk-sqlite` | `cln-cdk-postgres` | `cln-nutshell-postgres` |
|---|---|---|---|---|
| 1. Default mounted | ✓ live | ✓ live | ✓ live | ✓ live |
| 2. `more_vert` menu open *(desktop/tablet)* | ✓ live | ✓ live | ✓ live | ✓ live |
| 2. `more_vert` menu open *(mobile)* | — synthetic *(set `device_type` or use mobile project)* | — synthetic | — synthetic | — synthetic |
| 3. Backup form open | ✓ live | ✓ live | ✓ live | ✓ live |
| 4. Backup invalid filename | ✓ live | ✓ live | ✓ live | ✓ live |
| 5. Backup `SAVING` in flight | ✓ live *(transient, race to assert)* | ✓ live | ✓ live | ✓ live |
| 6. Backup success → download | ✓ live | ✓ live | ✓ live | ✓ live |
| 7. Backup error | — disruptive *(needs daemon down — `docker pause` mint container)* | — disruptive | — disruptive | — disruptive |
| 8. Restore form open | ✓ live | ✓ live | ✓ live | ✓ live |
| 9. Restore form file loading | — synthetic *(set `file_loading.set(50)`)* | — synthetic | — synthetic | — synthetic |
| 10. Restore form file ready | ✓ live *(test fixture: a tiny valid `.db` blob)* | ✓ live | ✓ live *(needs a `.sql` blob)* | ✓ live |
| 11. Restore SUCCESS | ✓ live *(sequenced: backup → docker stop mint → restore → docker start mint → healthcheck. Round-trips the just-created backup so daemon data is byte-identical post-restart.)* | ✓ live | ✓ live | ✓ live |
| 11. Restore ERROR | ✓ live *(submit a malformed file; orchard's `validateSqliteFile` rejects before unlinking the live DB. No daemon stop required.)* | ✓ live | ✓ live | ✓ live |
| 12. Toggle between CREATE and RESTORE | ✓ live | ✓ live | ✓ live | ✓ live |
| 13. Pending guard intercept | — out-of-scope *(covered by `event-general-unsaved-dialog` spec)* | — | — | — |

### Per-state probes

| State | Settled signal | Primary assert |
|---|---|---|
| 1. Default mounted | `page.locator('orc-mint-subsection-database orc-mint-subsection-database-control')` is visible | `expect(page.locator('orc-mint-subsection-database .orc-animation-collapsible.animation-open')).toHaveCount(0)` |
| 3. Backup form open | `page.locator('orc-mint-subsection-database-form-backup input[formControlName="filename"]')` is visible | `await expect(filenameInput).toHaveValue(/^MintDatabaseBackup-.+\.(db\|sql)$/)` |
| 3. Backup meta populated | `page.locator('orc-mint-subsection-database-form-backup mat-icon').filter({hasText: 'database'})` first to settle, then check the 3-row meta block via text | `await expect(formBackup).toContainText(version)` and `await expect(formBackup).toContainText(/sqlite\|postgres/)` |
| 4. Backup invalid filename | `page.locator('orc-mint-subsection-database-form-backup mat-error')` is visible | `await expect(matError).toContainText('Invalid')` |
| 6. Backup success → download | `page.waitForEvent('download')` (resolves only on the `<a download>` click) | `expect(download.suggestedFilename()).toMatch(/^MintDatabaseBackup-.+\.(db\|sql)$/)` |
| 8. Restore form open | `page.locator('orc-mint-subsection-database-form-restore button:has-text("Select Backup")')` is visible | `await expect(formRestore.locator('mat-icon.icon-lg')).toHaveClass(/file-not-ready/)` |
| 10. Restore file ready | `page.locator('orc-mint-subsection-database-form-restore mat-icon.icon-lg.file-ready')` is visible | `await expect(formRestore).not.toContainText('No file')` and `await expect(formRestore.locator('.invisible')).toHaveCount(0)` |
| 11. Restore SUCCESS | global event chip transitions to `SUCCESS` ("Backup restored!") | `await expectSuccessAndSettle(page, 'mint_database_restore')` and post-restart `expect(mint.getInfo(config, {fresh: true}))` matches the pre-backup baseline |
| 11. Restore ERROR | global event chip transitions to `ERROR` | `await expect(eventChip).toHaveAttribute(/event-state/, 'ERROR')` (chip locator pattern from `mint-subsection-info` spec) |
| 12. Toggle CREATE↔RESTORE | the *other* `.animation-open` collapsible | `await expect(page.locator('orc-mint-subsection-database .orc-animation-collapsible.animation-open')).toHaveCount(1)` always when one is open |

All locators above were verified live (`document.querySelectorAll(sel).length === 1`) on `lnd-nutshell-sqlite` with the host mounted in CREATE / RESTORE modes.

### Reusable interaction recipes

- **Trigger the file picker without the native dialog** — Playwright's [`fileChooser`](https://playwright.dev/docs/api/class-filechooser) event is the canonical handle: `const [chooser] = await Promise.all([page.waitForEvent('filechooser'), formRestore.locator('button:has-text("Select Backup")').click()]); await chooser.setFiles({name: 'fake.db', mimeType: 'application/octet-stream', buffer: Buffer.from('SQLite format 3\0')});`. Do NOT try to drive the hidden `<input type="file">` directly via `setInputFiles` against the parent — Playwright handles the chooser event regardless.
- **Capture the synthetic download** — `const [download] = await Promise.all([page.waitForEvent('download'), saveChip.click()]); expect(download.suggestedFilename()).toMatch(...);`. The download fires from `eventCreateSuccess`; if the SUCCESS event arrives before the listener attaches, the test races and fails. Always set up the `Promise.all` *before* the chip click.
- **Open the `more_vert` menu** — `await host.locator('button:has(mat-icon:has-text("more_vert"))').click(); const overlay = page.locator('.cdk-overlay-container'); await expect(overlay.getByText('Restore Backup')).toBeVisible();`.
- **Override `device_type` for mobile-menu probing without real viewport resize** — `await page.evaluate(() => { const cmp = window.ng.getComponent(document.querySelector('orc-mint-subsection-database')); cmp.device_type.set('mobile'); window.ng.applyChanges(cmp); });`. Note: this only changes the @switch render path; it does NOT change `BreakpointObserver`'s next emission, so a subsequent breakpoint match could revert it. Prefer Playwright's `page.setViewportSize({width: 360, height: 800})` before navigation when possible.
- **Event-chip locator** — reuse `eventChip(page)` from [`e2e/specs/mint-subsection-info.spec.ts`](./mint-subsection-info.spec.ts:1) (the parent's chip pattern is identical). Lifting that helper into a shared `e2e/helpers/ui/event-chip.ts` is recommended before writing this spec.
- **`expectSuccessAndSettle(page, mutationName)`** — same pattern as [`mint-subsection-info.spec.ts`](./mint-subsection-info.spec.ts:1); waits for the SUCCESS chip + a `matchGql` interception of the named mutation. Reuse for `mint_database_backup` and `mint_database_restore`.
- **Mint container stop/start** — use [`e2e/helpers/backend/docker-cli.ts`](../../e2e/helpers/backend/docker-cli.ts) (`exec('docker', ['stop', config.containers.mint])` / `['start', ...]`). After `start`, poll until `docker inspect --format='{{.State.Health.Status}}'` returns `healthy` (or use the existing healthcheck helper if one exists in the suite — search before adding). Bound the wait at ~30s. The `sqlite-reader` sidecar shares the volume but reads the file fresh per query; it tolerates the swap window without intervention.
- **Backup → restore round-trip** — the backup test produces a `Download` object; pass its `path()` directly to the restore step's `setFiles` via the file-chooser pattern. Do NOT round-trip through a fixture file on disk — Playwright's `Download` object has the buffer in-memory, and writing to disk introduces cleanup obligations. Example shape:
  ```ts
  const [download] = await Promise.all([page.waitForEvent('download'), saveChip.click()]);
  const buffer = await readFile(await download.path());  // path() returns a tmp path Playwright manages
  // ... docker stop mint ...
  await openRestore(page);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), selectBackup.click()]);
  await chooser.setFiles({name: download.suggestedFilename(), mimeType: 'application/octet-stream', buffer});
  ```

### Skip taxonomy

For the e2e spec scoped to "critical backup stuff", apply these tags to states the spec will *not* cover:

| State | Skip tag | Why |
|---|---|---|
| 7. Backup error | `disruptive` | needs `docker pause` of the mint container; sibling specs read the same daemon |
| 9. Restore form file loading (intermediate %) | `unit-better` | `FileReader.onprogress` is timing-sensitive; covered (or coverable) in Karma against the restore child |
| 11. Restore SUCCESS | covered | sequenced backup → docker stop → restore → docker start round-trip; daemon data is byte-identical post-restart so no fixture drift |
| 11. Restore ERROR | covered | malformed file rejection is non-destructive — orchard validates before unlinking the live DB |
| 13. Pending guard intercept | `dead-branch` *for this spec* | covered by `event-general-unsaved-dialog` spec |
| Mobile-menu Create Backup item | `unit-better` | viewport-driven; a single mobile-project run is cheaper than synthesising via `device_type.set` |
| Quote-paid dialog (`orc-mint-subsection-database-dialog-quote`) | out-of-scope | unrelated to backup; tested with the table spec |
| Filter / chart / table interactions | out-of-scope | covered by control / chart / table specs |
| AI tool-call `MintBackupFilenameUpdate` | `unit-better` | needs `ai_enabled=true` and a live model; structurally tested in Karma |

## Test fidelity hooks

No existing e2e spec for this component (`mint-subsection-database.spec.ts` does not exist yet). Recommended initial coverage, by tag:

- **`@canary`** — single test: open `/mint/database` → click `Create Backup` → assert default filename matches `/^MintDatabaseBackup-.+-\d{8}-\d{6}\.(db\|sql)$/` → click chip `Save` → `page.waitForEvent('download')` → assert `download.suggestedFilename()` matches the same pattern. Cleans up implicitly (no daemon mutation).
- **`@mint`** — structural: every child mounts (`form-backup`, `form-restore`, `control`, `chart`, `table`); both collapsibles closed by default; `more_vert` menu has the expected items per device.
- **`@mint`** — backup invalid filename: clear the field → assert `mat-error` visible → assert chip `Save` is blocked (no GQL fired, no download).
- **`@mint`** — backup meta fidelity: filename includes the daemon's reported version (with `/`→`-` applied) AND the implementation matches the project's `db` config.
- **`@mint`** — restore form mounts: open via menu → file-not-ready icon class + help-text 4-step list visible. *No file selection.*
- **`@mint`** — restore close: open → click ✕ → `form_mode === null`, chip clear, collapsible closed.
- **`@mint`** — toggle CREATE↔RESTORE: open backup → open restore → assert exactly one collapsible has `.animation-open` at all times.
- **`@mint`** — backup → restore round-trip (single sequenced test):
  1. baseline = `mint.getInfo(config, {fresh: true})`
  2. open Create Backup, chip Save, capture `download`
  3. `docker stop {config.containers.mint}` (exec via `docker-cli` helper)
  4. open Restore Backup, `setFiles` from the captured download buffer, chip Save
  5. `expectSuccessAndSettle(page, 'mint_database_restore')`
  6. `docker start {config.containers.mint}`, poll for healthy
  7. `expect(mint.getInfo(config, {fresh: true})).toEqual(baseline)`
- **`@mint`** — restore ERROR: open Restore Backup, `setFiles` a malformed `.db` (e.g. `Buffer.from('not a sqlite header')`), chip Save, assert ERROR chip surfaces `MintDatabaseRestoreInvalidError` mapping. No docker stop required — orchard rejects before unlinking.

States explicitly skipped (per *Skip taxonomy*):

- Backup error (`disruptive` — needs `docker pause`; sibling specs read the same daemon)
- Restore mid-file-loading (`unit-better`)
- Pending-guard interception (`dead-branch` here)
- Mobile-menu Create Backup placement (`unit-better`)
- Quote-paid dialog, AI tool calls, filter/chart/table — out of scope

Child-component states the e2e spec will skip:

- backup `meta loading` shimmer (sub-second, racy)
- restore `file read error` divergent state (synthetic / unit-better)
- restore `file replaced` (unit-better)

## Notes for implementers

- **Backup encoded payload lifetime** — `backup_encoded` is held on the parent between `eventCreateConfirmed` (set on SUCCESS response) and `eventCreateSuccess` (cleared after `<a>.click()`). It is the full base64-encoded database. For sqlite databases this is bounded; for large postgres dumps the orchard JS heap will balloon temporarily. Don't introduce retries that hold the payload longer than needed.
- **`ngOnInit` reset** — `this.form_backup.reset()` is called in `ngOnInit` even though the form is constructed with null defaults. This is defensive against a back-navigation re-mounting the component with a stale form value (Angular's component pool can keep instances around briefly). Don't remove without checking.
- **`MatDialog` import is for the quote dialog only** — the backup/restore flows do not open a dialog; they are inline collapsibles driven by `form_mode`.
- **`canDeactivate` only blocks router navigation** — `@HostListener('window:beforeunload')` returns the boolean but the browser's beforeunload protocol requires the listener to call `event.preventDefault()` and set `returnValue` to actually prompt. The current implementation does not, so a tab-close or hard-refresh during a `PENDING` event silently discards the form state. Per `AGENTS.md` self-hosted FOSS posture this is acceptable; document, don't try to fix in a way that might break Tor / private-window flows.
- **Filename slash-replace is one-way** — `database_version = mint_info.version.replace(/\//g, '-')`. The original value is not retained on the parent. If the backup workflow ever needs to re-derive the version from the filename, the round-trip will not be exact when the original version contained `/`.
- **Form-restore valueChanges chip registration** — fires on every patch, including the synthetic patch from `onFileSelected` and the parallel patch from `onload`. `dirty` is true after the first patch so both chip-registration calls fire `PENDING`; the second is a no-op because the event is already pending. If a future change makes events de-duplicate by *content*, the chip might flicker — keep an eye on this.
- **`OnPush` + manual `cdr.detectChanges()`** — every async path in this component ends with a manual `detectChanges`. If you add a new mutation handler, follow the pattern; the component does not rely on signal-driven rerenders for the form-mode transitions because `form_mode` is a plain field.
