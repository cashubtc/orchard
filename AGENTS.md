# AGENTS.md

General behavioral guidelines for any AI agent working in this repository.

## Deployment Context: Self-Hosted FOSS

Orchard is free and open source software. Anyone can clone it, configure it, and run it — on a laptop, a VPS, a home server, behind Tor, behind a reverse proxy, on ARM, on x86, with lnd or cln, with cdk or nutshell, with or without tapd, with or without ollama. We ship the code; operators run it. **There is no production we control.**

### What this means in practice

- **No prod telemetry, no prod logs, no prod access.** We cannot SSH in, tail a log, query a DB, or reproduce an operator's exact state. Debugging starts from a GitHub issue, a user report, or a screenshot — never from our own observability stack.
- **The deployment matrix is unbounded.** Node versions, OS, backend combinations (lnd+cdk, cln+nutshell, etc.), network topologies (clearnet, Tor, LAN-only), reverse proxies, TLS setups, and custom `.env` configs all vary. Any change must assume a configuration we've never seen.
- **No coordinated upgrades.** Operators update when they feel like it. A fix shipped today may not reach a user for months. Breaking changes, migrations, and schema edits need to degrade gracefully or fail loudly with actionable errors — silent assumptions about "the latest version" will bite real users.
- **No feature flags we control.** We can't hotfix, roll back, or gate rollouts per-operator. Once a release is cut and pulled, it runs. Bugs stick around until the operator updates.
- **Error messages are the support channel.** Since we can't see their logs, errors surfaced in the UI or server logs must be self-explanatory enough for the operator to act on or paste into an issue. "Something went wrong" is useless; "cln socket at $PATH unreachable — check CLN_SOCKET" is actionable.
- **Defaults matter more than in SaaS.** Whatever defaults ship are what most operators will run. A bad default is a bug replicated across every deployment.
- **Backwards compatibility is load-bearing.** Users who skip versions still need migrations to run clean. DB migrations, config schema changes, and API contracts should assume jumps, not linear upgrades.

### Decision-making implications

- Prefer resilience over elegance when the two conflict. Code that tolerates weird environments beats code that only works in ours.
- Surface config problems at startup with clear messages, not at request-time with stack traces.
- Validate external inputs (backend RPCs, user config) defensively — these are system boundaries with unknowable operators on the other side.
- When a bug is reported, ask for version + config + logs first, because we have no other way to narrow it down.
- Avoid "we'll monitor it in prod" reasoning — there is no prod we can monitor.

## Workflow

- **Verify before done.** Don't mark a task complete without proving it works — run tests, check logs, exercise the feature. If you can't verify (e.g. UI change with no way to test), say so explicitly.
- **Bias toward fixing.** When given a bug report or failing test, just fix it — don't ask for hand-holding. Point at the error, resolve it, move on.
- **Stop and re-plan when things go sideways.** If an approach isn't working, don't keep pushing — pause and reconsider before digging deeper.

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.

## Code Standards

- Always fully type your code
- For classes & services use PascalCase
- For functions use camelCase
- For variables use snake_case
- For CSS class names use kebab-case
- Include JSDoc comments for functions
- Keep your code DRY and avoid deep nesting and triangles of doom
- Patterns in the front end should be data down and actions up

## TypeScript File Structure

All `.ts` component and service files must follow this ordering convention. Each section should be separated by a blank line.

### 1. Imports (grouped by category, separated by blank lines)

```ts
/* Core Dependencies */        // Angular core, router, CDK, etc.
/* Vendor Dependencies */      // Third-party libs (luxon, rxjs, material, etc.)
/* Application Dependencies */ // Cross-module app imports (@client/modules/...)
/* Native Dependencies */      // Same-module imports (@client/modules/<this-module>/...)
/* Shared Dependencies */      // Generated types from @shared/
```

### 2. Class Body (strict top-to-bottom ordering)

```ts
export class ExampleComponent implements OnInit, OnDestroy {
    // ── Injected dependencies (private readonly, using inject()) ──
    private readonly myService = inject(MyService);
    private readonly router = inject(Router);

    // ── Public properties (non-reactive) ──
    public page_settings!: SomeType;
    public data_source = new MatTableDataSource<Item>([]);

    // ── Public signals ──
    public readonly count = signal<number>(0);
    public readonly error = signal<boolean>(false);

    // ── Public computed signals ──
    public readonly total = computed(() => this.count() * 2);

    // ── Private properties (non-reactive) ──
    private genesis_timestamp = 0;

    // ── Private signals ──
    private readonly loading_items = signal<boolean>(true);
    private readonly loading_users = signal<boolean>(true);

    // ── Private computed signals ──
    public readonly loading = computed(() => this.loading_items() || this.loading_users());

    // ── Private non-signal fields ──
    private subscriptions = new Subscription();

    // ── Constructor (only if needed beyond inject()) ──
    constructor() { }

    // ── Lifecycle: Init ──
    ngOnInit(): void { }

    // ── Methods (organized by section headers) ──

    /* *******************************************************
        Section Name
    ******************************************************** */

    /** JSDoc for each method */
    public onSomeAction(): void { }

    private loadData(): void { }

    /* *******************************************************
        Destroy
    ******************************************************** */

    ngOnDestroy(): void {
        this.subscriptions.unsubscribe();
    }
}
```

### Key rules

- **Dependencies**: Always use `inject()`, never constructor injection. Mark as `private readonly`.
- **Signals over primitives**: Prefer `signal()` / `computed()` for any reactive state.
- **Section headers**: Group related methods under comment block headers (Settings, Subscriptions, Data, Actions Up, Agent, Destroy, etc.).
- **`ngOnInit` at the top of methods**: Sits between properties and the method sections.
- **`ngOnDestroy` always last**: Cleanup logic is the final section in the class body.
- **Spec files required**: Every new `.component.ts` or `.service.ts` file must have an accompanying `.spec.ts` file created alongside it.

## Security fixes

When a task involves a vulnerability or an uncoordinated security fix, do not
describe the exploit in depth in anything public: PR titles or bodies, commit
messages, review comments, or code comments. Keep the public summary high-level
(state that a security issue was fixed) and leave out reproduction steps, proofs
of concept, root-cause specifics, and attack paths.

Until a fix has been released and disclosure has been coordinated, send the
detailed write-up to the security contact listed under "Reporting a Vulnerability"
in `.github/SECURITY.md`.
