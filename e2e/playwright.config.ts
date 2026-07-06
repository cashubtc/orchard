import {defineConfig, devices, type Project} from '@playwright/test';
import {CANARY, CONFIGS, portOf, tagsFor} from './helpers/config';
import type {ConfigInfo} from './types/config';

/**
 * One project per Docker config. Stack must be running (`npm run e2e:up <config>`)
 * before `npm run e2e:test` — there's no webServer hook because each project's
 * stack is bespoke.
 *
 * Each config gets FOUR Playwright projects, chained via `dependencies`:
 *   1. `setup-<config>`     — runs `auth.setup.ts`, writes initial storage
 *                             state to `e2e/.auth/<config>.json`.
 *   2. `settings-<config>`  — depends on (1), loads that storage state, runs
 *                             `settings.setup.ts` to apply the per-stack
 *                             settings matrix via the `/settings/app` and
 *                             `/settings/device` UIs, and writes the now-
 *                             populated state back to the same file.
 *   3. `oracle-<config>`    — depends on (2), runs `oracle.setup.ts` to
 *                             stage backend state that downstream `@oracle`
 *                             specs depend on (drives the Backfill Prices
 *                             flow for yesterday). Tagged `@oracle` so it
 *                             matches zero tests on stacks without the
 *                             feature, completing instantly there.
 *   4. `<config>`           — depends on (3), loads the settings-augmented
 *                             state, runs the actual specs.
 *
 * The canary stack additionally gets a role tier:
 *   5. `roles-<canary>`     — depends on (2), runs `roles.setup.ts`:
 *                             provisions the READER user through the real UI
 *                             flow (crew invite → signup) and writes
 *                             `e2e/.auth/<config>.reader.json`. Idempotent —
 *                             once the reader exists it just refreshes state.
 *   6. `<canary> (reader)`  — depends on (5), runs `*.reader.spec.ts` files
 *                             under the reader storage state. Roles live in
 *                             Orchard's own user table, independent of the
 *                             backend matrix, so canary-only coverage is
 *                             intentional. Reader specs are testIgnore'd
 *                             from the regular projects.
 *
 * The auth split amortizes login across every spec — Orchard's auth throttler
 * (~4 req/10s) would otherwise trip around the 5th login per config. The
 * settings split keeps the operator-driven settings UI exercised once per
 * stack lifetime instead of per-spec, and bakes its results into storageState
 * so specs continue to start in a fully-configured Orchard. The oracle split
 * stages backend state (price feed) without touching storageState.
 *
 * `workers` is set to one slot per stack so all 5 stacks' setup chains run
 * in parallel and the spec phase distributes spec files across stacks. The
 * setup → settings → specs chain inside each stack is preserved by project
 * `dependencies`, independent of worker count. Tests within a single spec
 * file still run in source order on one worker (`fullyParallel: false`,
 * Playwright's default) — if a spec file mutates shared Orchard state and
 * flakes when run alongside other files, mark that file with
 * `test.describe.configure({mode: 'serial'})`.
 *
 * Storage state path is cwd-relative; `npm run e2e:test` always runs from
 * the repo root, so `e2e/.auth/<name>.json` lands under `e2e/.auth/` where
 * `.gitignore` already excludes it.
 *
 * ## Tag-based scoping
 *
 * Specs declare which stacks a test is relevant to via tags. Each real
 * project's `grep` is computed from its `ConfigInfo` — a test runs on a
 * stack only if one of its tags matches the stack's grep.
 *
 * Tag vocabulary:
 *
 *   @canary              — config-agnostic; runs only on the canary stack
 *                          (lnd-nutshell-sqlite). Most feature specs are @canary.
 *   @lightning           — app-state: LIGHTNING_TYPE wired; runs on stacks
 *                          with a real LN backend (config.ln !== false)
 *   @no-lightning        — app-state: Orchard booted without LIGHTNING_TYPE;
 *                          runs on fake-cdk-postgres only
 *   @bitcoin             — app-state: BITCOIN_TYPE wired; runs on stacks with
 *                          a real bitcoind backend (config.bitcoin === true).
 *                          Use for UI gated on the bitcoin tile mounting,
 *                          where @lightning would over-include or @canary
 *                          would under-include.
 *   @no-bitcoin          — app-state: Orchard booted without BITCOIN_TYPE;
 *                          runs on fake-cdk-postgres only
 *   @mint                — app-state: a mint backend (cdk or nutshell) is
 *                          wired up. Every shipped stack has one today, so
 *                          this currently matches `@all` — it exists so
 *                          mint-feature specs read honestly and can be
 *                          grepped on their own (`--grep @mint`).
 *   @lnd / @cln          — LN impl-name tags; runs on stacks with matching ln.
 *                          Reserve for impl-specific behavior — most specs
 *                          want @lightning / @no-lightning instead.
 *   @cdk / @nutshell     — mint-impl-sensitive; runs on stacks with matching mint
 *   @sqlite / @postgres  — DB-sensitive; runs on stacks with matching db
 *   @tapd                — requires tapd; runs only on lnd-cdk-sqlite
 *   @bolt12              — requires bolt12-capable mint + LN; runs only on
 *                          cln-cdk-postgres
 *   @mainchain           — requires a real mainnet bitcoind wired into Orchard
 *                          (oracle, mempool, block-tip, chain-sync code).
 *                          Runs only on cln-nutshell-postgres (the only stack
 *                          that ships `compose.mainchain.yml`, which is always
 *                          loaded when present).
 *   @ai                  — config-state: settings setup turned `ai.enabled`
 *                          on for this stack (cln-cdk-postgres only). Use
 *                          for specs that need a live AI integration.
 *   @oracle              — config-state: settings setup turned the bitcoin
 *                          oracle on for this stack (cln-nutshell-postgres
 *                          only — pairs with @mainchain). Use for specs that
 *                          need a populated price feed.
 *   @all                 — genuine matrix coverage; runs on every stack
 *
 * Untagged tests match no project's grep → they don't run. If you see a new
 * spec silently skipping, it probably needs a `{tag: '@canary'}` annotation
 * on the test (or describe).
 *
 * Setup projects use the same grep as their real project, so auth-flow
 * tests are tag-scoped too. The happy-path `authenticate + persist state`
 * test is tagged `@all` so it runs on every stack; the fresh-stack
 * validation cases are tagged `@canary` so they only run on canary. The
 * `settings.setup.ts` test is tagged `@all` for the same reason — it runs
 * on every stack, even canary (where it's a fast no-op since canary's
 * matrix leaves all settings unset).
 */

function grepFor(config: ConfigInfo): RegExp {
	return new RegExp(
		tagsFor(config)
			.filter((t) => t !== '@ai') // AI tests run only via `npm run e2e:test:ai`
			.map((t) => `(${t})`)
			.join('|'),
	);
}

function projectsFor(config: ConfigInfo): Project[] {
	const projectName = `${config.name}:${portOf(config)}`;
	const setupName = `setup-${projectName}`;
	const settingsName = `settings-${projectName}`;
	const oracleName = `oracle-${projectName}`;
	const rolesName = `roles-${projectName}`;
	const baseURL = config.orchardUrl;
	const storageState = `e2e/.auth/${config.name}.json`;
	const isCanary = config.name === CANARY;
	// The default spec project waits on the oracle chain, and on canary also
	// on roles setup — some canary specs (crew-user admin flow) depend on the
	// READER user roles.setup provisions, and the e2e stacks reset their
	// Orchard DB on recreation, so the reader must be re-provisioned each run.
	const specDependencies = isCanary ? [oracleName, rolesName] : [oracleName];
	return [
		{
			name: setupName,
			testDir: './setup',
			testMatch: /auth\.setup\.ts$/,
			grep: grepFor(config),
			use: {...devices['Desktop Chrome'], baseURL},
		},
		{
			name: settingsName,
			testDir: './setup',
			testMatch: /settings\.setup\.ts$/,
			dependencies: [setupName],
			grep: grepFor(config),
			use: {...devices['Desktop Chrome'], baseURL, storageState},
		},
		{
			name: oracleName,
			testDir: './setup',
			testMatch: /oracle\.setup\.ts$/,
			dependencies: [settingsName],
			grep: grepFor(config),
			use: {...devices['Desktop Chrome'], baseURL, storageState},
		},
		{
			name: projectName,
			testDir: './specs',
			testMatch: /.*\.spec\.ts$/,
			// Reader-role specs run in the dedicated reader project below
			// with the reader storage state — never as the admin.
			testIgnore: /.*\.reader\.spec\.ts$/,
			dependencies: specDependencies,
			grep: grepFor(config),
			use: {...devices['Desktop Chrome'], baseURL, storageState},
		},
		// ── Role projects (canary only) ──
		// Roles live in Orchard's own user table, independent of the
		// bitcoin/LN/mint backends, so one stack's coverage is the coverage.
		// `roles-<canary>` provisions the READER through the real UI flow
		// (crew invite → signup) and persists `<config>.reader.json`;
		// `<canary> (reader)` runs `*.reader.spec.ts` files under that state.
		...(isCanary
			? [
					{
						name: rolesName,
						testDir: './setup',
						testMatch: /roles\.setup\.ts$/,
						dependencies: [settingsName],
						grep: grepFor(config),
						use: {...devices['Desktop Chrome'], baseURL, storageState},
					},
					{
						name: `${projectName} (reader)`,
						testDir: './specs',
						testMatch: /.*\.reader\.spec\.ts$/,
						dependencies: [`roles-${projectName}`],
						grep: grepFor(config),
						use: {...devices['Desktop Chrome'], baseURL, storageState: `e2e/.auth/${config.name}.reader.json`},
					},
				]
			: []),
	];
}

export default defineConfig({
	tsconfig: './tsconfig.json',
	outputDir: './test-results',
	timeout: 30_000,
	expect: {timeout: 5_000},
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 1 : 0,
	workers: Object.keys(CONFIGS).length,
	reporter: process.env.CI
		? [['./helpers/summary-reporter.ts'], ['list'], ['html', {open: 'never', outputFolder: './e2e/playwright-report'}]]
		: [['./helpers/summary-reporter.ts'], ['list']],
	use: {
		trace: 'retain-on-failure',
		screenshot: {mode: 'only-on-failure', fullPage: true},
		// fullPage: failure screenshots capture the full scrollable document so
		// rows that render below the viewport on tall dashboards are visible.
	},
	projects: Object.values(CONFIGS).flatMap(projectsFor),
});
