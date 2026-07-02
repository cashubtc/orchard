/**
 * Feature spec: `orc-mint-general-config` — the "Config" card on /mint
 * that surfaces the mint daemon's NUT-06 advertised capabilities (which
 * NUTs it supports, whether minting/melting are enabled, and the
 * min→max range per `(method, unit)` for both directions).
 *
 * Differential against the live mint daemon. Each test reads the mint's
 * own NUT-06 `/v1/info` via the `mint` helper (docker-execs into the
 * mint container) and asserts the rendered card matches that truth —
 * chip set, chip palettes, pill states, limit rows, min/max values.
 *
 * Chip set is schema-driven, not daemon-driven. The component iterates
 * `Object.entries(info.nuts)` over the GraphQL response, and the
 * `MINT_INFO_QUERY` always selects every nullable `nutN` field on the
 * `OrchardNuts` type. So every fixture renders 16 chips today
 * (4, 5, 7-12, 14, 15, 17, 19, 20, 21, 22, 29) — one per schema field —
 * regardless of which subset the daemon actually publishes. Chip dot
 * status is what does branch by daemon: a `null` GraphQL value (e.g.
 * nutshell's nut19/21/22/29 or cdk's nut21/22) lands in the `disabled`
 * palette via `getNutStatus`, while a populated object lands in
 * `enabled` (or `active` for NUT-04/05 when `disabled: false`).
 *
 * Per-fixture branching. cdk publishes explicit min=1/max=500_000 and
 * `nut19/29: {…}`; nutshell publishes both bounds as `null` and omits
 * `nut19/21/22/29` entirely. The component renders `1` for null mins
 * and `∞` for null maxes — both branches asserted below from the
 * helper truth.
 *
 * Covers states reachable from a healthy regtest fixture:
 *   - structure: title, mat-card, supported-nuts caption
 *   - chip set: 16 chips in schema order, dot palette per
 *     `getNutStatus()`'s rules (active for NUT-04/05 not-disabled,
 *     enabled for any other supported NUT, disabled for `null`)
 *   - status pills: "Minting enabled|disabled" and
 *     "Melting enabled|disabled" reflect `nut4.disabled` / `nut5.disabled`
 *   - limit rows: one row per `nut4.methods[]` / `nut5.methods[]` entry,
 *     each rendering `orc-graphic-asset` for the unit, an
 *     `orc-mint-general-payment-method` badge for the method, and the
 *     min → max numeric range (with `1` / `∞` fallbacks for null)
 *
 * States the component supports but this spec does NOT cover (see
 * `mint-general-config.md` → "Skip taxonomy"):
 *   - `nut4.disabled`/`nut5.disabled` red palettes (no fixture toggles
 *     these — would need a dedicated minting-disabled docker config)
 *   - BOLT 12 method rendering (no fixture publishes `bolt12` in
 *     `nuts.nut4.methods`/`nuts.nut5.methods`; the LN backend on
 *     cln-cdk-postgres speaks bolt12 but its mintd.toml advertises only
 *     `bolt11` to the cashu API)
 *   - multi-method bar-width scaling with the 5% floor (only one row
 *     per direction on every fixture; covered in unit tests instead)
 *   - mixed-units rendering (sat + usd) — only fake-cdk-postgres
 *     advertises usd and that stack is not in the e2e mint matrix
 *   - NUT-21 / NUT-22 populated chip palette (`enabled` branch) — no
 *     fixture publishes auth-enabled nut21/22 today, so only the `null`
 *     → `disabled` branch is reachable here
 *   - `info()` null fallthrough — parent only mounts the card after
 *     the resolver succeeds, so this is dead from production parents
 * See `mint-general-config.md` for the full state machine.
 */

import {test, expect, type Locator, type Page} from '@playwright/test';

import {getConfig} from '@e2e/helpers/config';
import {mint} from '@e2e/helpers/backend';
import type {MintNutLimitBlock, MintNutLimitMethod, MintNutsBlock} from '@e2e/types/mint';

async function openConfigCard(page: Page): Promise<Locator> {
	// Only one mount: the /mint subsection dashboard. Scope by selector
	// rather than `.first()` so a regression that mounts a stray copy on
	// another page would surface as a strict-mode failure.
	const card = page.locator('orc-mint-general-config');
	await expect(card).toBeVisible();
	// The chip block + pill row settle together once `info()` resolves;
	// the parent's `mintInfoResolver` blocks the route, so the card never
	// renders empty. Use the "Supported Nuts" caption as the settled
	// signal — present in every reachable state including the empty one.
	await expect(card.getByText('Supported Nuts', {exact: true})).toBeVisible();
	return card;
}

/** Mirror of the component's `getNutStatus` (mint-general-config.component.ts:81)
 *  — returns the same `GraphicStatusState` string the chip dot's class is
 *  driven from, given a NUT number and the raw value the daemon emitted
 *  under `info.nuts[`nut${N}`]`. Tests read this side-by-side with the
 *  daemon truth and assert the chip's `.indicator-circle` carries the
 *  matching class. */
function expectedNutStatus(num: number, nut: unknown): 'inactive' | 'active' | 'disabled' | 'enabled' {
	if (nut == null || typeof nut !== 'object') return num === 4 || num === 5 ? 'inactive' : 'disabled';
	const obj = nut as Record<string, unknown>;
	const is_disabled = 'disabled' in obj && obj.disabled === true;
	const is_supported = 'supported' in obj && Boolean(obj.supported);
	if (num === 4 || num === 5) return is_disabled ? 'inactive' : 'active';
	if ('disabled' in obj) return is_disabled ? 'disabled' : 'enabled';
	if ('supported' in obj) return is_supported ? 'enabled' : 'disabled';
	return 'enabled';
}

const STATUS_BG_CLASS: Record<ReturnType<typeof expectedNutStatus>, string> = {
	active: 'orc-status-active-bg',
	inactive: 'orc-status-inactive-bg',
	enabled: 'orc-primary-bg',
	disabled: 'orc-outline-variant-bg',
};

/** NUT numbers Orchard's GraphQL schema (`OrchardNuts`) exposes to the
 *  client, in the order they appear in `MINT_INFO_QUERY`. Every field is
 *  `nullable: true` past NUT-04/05 — the resolver returns `null` when the
 *  daemon doesn't publish that NUT — but the *key* is always present in
 *  the GraphQL response, so the component's `Object.entries(info.nuts)`
 *  iteration always yields one chip per schema field. This list is the
 *  source of truth for the chip count and order; the daemon's `/v1/info`
 *  only determines each chip's *status* (the dot palette). When Orchard
 *  exposes a new NUT in the schema, append it here and the spec will pick
 *  up the new chip without further edits. */
const ORCHARD_NUTS = [4, 5, 7, 8, 9, 10, 11, 12, 14, 15, 17, 19, 20, 21, 22, 29] as const;

/** One entry per schema-known NUT, paired with whatever value the daemon
 *  published under that key in `/v1/info`. Daemon keys may be raw cashu
 *  numerics (`"4"`) or Orchard `nutN` form — both are accepted. NUTs the
 *  daemon doesn't publish surface as `value: null`, mirroring how the
 *  GraphQL resolver fills missing fields and how the component's
 *  `getNutStatus(num, null)` interprets them as `'disabled'`. Always
 *  returns `ORCHARD_NUTS.length` entries (never filters), so chip-count
 *  and chip-order assertions are stable across daemons. */
function nutEntries(nuts: MintNutsBlock | undefined): Array<{number: number; value: unknown}> {
	const by_number = new Map<number, unknown>();
	if (nuts) {
		for (const [key, value] of Object.entries(nuts)) {
			const m = key.match(/^(?:nut)?(\d+)$/);
			if (!m) continue;
			by_number.set(parseInt(m[1], 10), value);
		}
	}
	return ORCHARD_NUTS.map((n) => ({number: n, value: by_number.has(n) ? by_number.get(n) : null}));
}

/** Strip non-digits to recover the integer the daemon stored. The
 *  `localAmount` pipe wraps amounts in glyph/locale formatting (e.g.
 *  "₿ 500,000", "500,000 sat", "500.000 sat" on es-ES); stripping
 *  non-digits is locale- and currency-display-independent. */
function amountFromText(text: string | null | undefined): number {
	const stripped = (text ?? '').replace(/\D/g, '');
	return stripped === '' ? 0 : parseInt(stripped, 10);
}

/** Read the limit row's min and max cell text, returning the underlying
 *  integer (or the literal `'∞'` for an unbounded max). The component
 *  falls back to literal `1` for null `min_amount` and `'∞'` for null
 *  `max_amount`; the assertions below feed `expected*Display(method)`
 *  to compare apples-to-apples. */
async function readLimitRow(row: Locator): Promise<{min: number; max: number | '∞'}> {
	const min_text = (await row.locator('.limit-range-min').textContent()) ?? '';
	const max_text = (await row.locator('.limit-range-max').textContent()) ?? '';
	return {
		min: amountFromText(min_text),
		max: max_text.trim() === '∞' ? '∞' : amountFromText(max_text),
	};
}

/** Pull a specific NUT block by number from the daemon's `/v1/info`,
 *  accepting both cashu-spec numeric keys and Orchard-schema `nutN`
 *  keys. Used for NUT-04 / NUT-05 fetches where the test needs the full
 *  `MintNutLimitBlock` (disabled flag + methods) rather than a raw
 *  `unknown`. Returns undefined if the daemon doesn't publish the NUT. */
function nutBlock(nuts: MintNutsBlock | undefined, num: number): MintNutLimitBlock | undefined {
	if (!nuts) return undefined;
	const direct = nuts[String(num)] ?? nuts[`nut${num}`];
	if (!direct || typeof direct !== 'object') return undefined;
	const obj = direct as Record<string, unknown>;
	if (typeof obj.disabled !== 'boolean' || !Array.isArray(obj.methods)) return undefined;
	return obj as unknown as MintNutLimitBlock;
}

function expectedMinDisplay(method: MintNutLimitMethod): number {
	return method.min_amount ?? 1;
}
function expectedMaxDisplay(method: MintNutLimitMethod): number | '∞' {
	return method.max_amount ?? '∞';
}

/** Map `bolt11` → `BOLT 11`, `bolt12` → `BOLT 12`, anything else →
 *  the raw method string. Mirrors `mint-general-payment-method`'s
 *  template `@switch` so the assertion is unambiguous. */
function expectedMethodLabel(method: string): string {
	if (method === 'bolt11') return 'BOLT 11';
	if (method === 'bolt12') return 'BOLT 12';
	return method;
}

/** Map a unit string to the `orc-graphic-asset` class the disc carries.
 *  Mirrors `unit_class` in graphic-asset.component.ts. */
function expectedAssetClass(unit: string): string {
	const u = unit.toLowerCase();
	if (u === 'sat' || u === 'msat' || u === 'btc') return 'graphic-asset-btc';
	if (u === 'usd') return 'graphic-asset-usd';
	if (u === 'eur') return 'graphic-asset-eur';
	return 'graphic-asset-unknown';
}

test.describe('mint-general-config card', {tag: '@mint'}, () => {
	test.beforeEach(async ({page}) => {
		// `/mint` is the only route that mounts this card (the index dashboard
		// hosts a different mint summary surface that does not render config).
		await page.goto('/mint');
	});

	test('renders the config card with a "Config" title', async ({page}) => {
		const card = await openConfigCard(page);
		await expect(card.getByText('Config', {exact: true})).toBeVisible();
		await expect(card.locator('mat-card')).toHaveCount(1);
	});

	test('renders one chip per schema-exposed `nutN` field', async ({page}) => {
		// Chip count is schema-driven: every nullable `nutN` field on
		// `OrchardNuts` is selected by `MINT_INFO_QUERY`, so the GraphQL
		// response always includes all 16 keys (some as `null`) and the
		// component renders one chip per key. This holds on every fixture
		// regardless of which subset the daemon publishes.
		const card = await openConfigCard(page);
		await expect(card.locator('.nut-card')).toHaveCount(ORCHARD_NUTS.length);
	});

	test('chip numbers match the schema NUT order', async ({page}) => {
		const card = await openConfigCard(page);
		const numbers = await card.locator('.nut-card .font-weight-semi-bold').allTextContents();
		expect(numbers.map((n) => parseInt(n.trim(), 10))).toEqual([...ORCHARD_NUTS]);
	});

	test('chip dot palette matches the daemon nut value (active/enabled/disabled)', async ({page}, testInfo) => {
		// Differential. NUT-04 + NUT-05 are `active` (green) when not
		// `disabled`; every other supported NUT is `enabled` (primary
		// dot); a key the daemon doesn't publish (or publishes as `null`,
		// e.g. nutshell's nut19/21/22/29 or cdk's nut21/22) becomes
		// `disabled` (grey). The mapping is locale-independent and
		// fixture-stable.
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		const entries = nutEntries(info.nuts);

		const card = await openConfigCard(page);
		const chips = card.locator('.nut-card');
		for (let i = 0; i < entries.length; i++) {
			const expected = expectedNutStatus(entries[i].number, entries[i].value);
			const class_re = new RegExp(STATUS_BG_CLASS[expected]);
			await expect(chips.nth(i).locator('.indicator-circle')).toHaveClass(class_re);
		}
	});

	test('chips for NUTs the daemon omits render with the disabled palette', async ({page}, testInfo) => {
		// Schema-decoupled assertion: any NUT past 4/5 whose daemon value
		// is missing or null must land in the grey `disabled` palette.
		// This is the failure mode an operator sees when running an older
		// daemon against a schema that's grown — the chip stays in the
		// row but signals "your daemon doesn't speak this NUT" without
		// silently dropping. nutshell guarantees coverage of nut19/21/22/29
		// and cdk covers nut21/22; together every fixture exercises the
		// branch even though no single fixture covers all four.
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		const entries = nutEntries(info.nuts);
		const missing = entries
			.map((e, i) => ({...e, idx: i}))
			.filter((e) => e.number !== 4 && e.number !== 5 && (e.value === null || e.value === undefined));
		test.skip(missing.length === 0, 'daemon publishes every schema NUT — disabled-palette branch unreachable');

		const card = await openConfigCard(page);
		const chips = card.locator('.nut-card');
		for (const e of missing) {
			await expect(chips.nth(e.idx).locator('.indicator-circle')).toHaveClass(/orc-outline-variant-bg/);
		}
	});

	test('chips for NUTs the daemon publishes (past 4/5) render with the enabled palette', async ({page}, testInfo) => {
		// Mirror of the disabled-palette test — every schema NUT past 4/5
		// whose daemon value is a populated object must land in the
		// primary `enabled` palette. cdk publishes nut7-12, 14, 15, 17,
		// 19, 20, 29 as objects; nutshell publishes nut7-12, 14, 15, 17,
		// 20. Each fixture therefore exercises the branch on a different
		// subset, but together cover every reachable enabled chip.
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		const entries = nutEntries(info.nuts);
		const present = entries
			.map((e, i) => ({...e, idx: i}))
			.filter((e) => e.number !== 4 && e.number !== 5 && e.value !== null && typeof e.value === 'object');
		test.skip(present.length === 0, 'daemon publishes no NUTs past 4/5 — enabled branch unreachable');

		const card = await openConfigCard(page);
		const chips = card.locator('.nut-card');
		for (const e of present) {
			await expect(chips.nth(e.idx).locator('.indicator-circle')).toHaveClass(/orc-primary-bg/);
		}
	});

	test('NUT-04 and NUT-05 chips carry the active palette when not disabled', async ({page}, testInfo) => {
		// NUT-04/05 use a different palette than every other NUT: green
		// (`active`) when `disabled: false`, red (`inactive`) when
		// `disabled: true`. No fixture toggles `disabled: true`, so the
		// `inactive` branch is fixture-only and covered in the karma spec
		// instead. This test pins the live `active` branch on every stack.
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		const nut4 = nutBlock(info.nuts, 4);
		const nut5 = nutBlock(info.nuts, 5);
		test.skip(!nut4 || !nut5, 'daemon does not publish nut4 or nut5');
		test.skip(nut4!.disabled || nut5!.disabled, 'fixture toggles disabled: true — covered in karma');

		const card = await openConfigCard(page);
		const chips = card.locator('.nut-card');
		await expect(chips.nth(0).locator('.indicator-circle')).toHaveClass(/orc-status-active-bg/);
		await expect(chips.nth(1).locator('.indicator-circle')).toHaveClass(/orc-status-active-bg/);
	});

	test('renders the "Supported Nuts" caption beneath the chip row', async ({page}) => {
		const card = await openConfigCard(page);
		await expect(card.getByText('Supported Nuts', {exact: true})).toBeVisible();
	});

	test('chip numbers are unique', async ({page}) => {
		// Defends against the schema-drift gotcha called out in the
		// component spec: a malformed `nutNa`-like key would still match
		// `key.startsWith('nut')` and `parseInt('Na', 10)` would yield a
		// duplicate of an existing chip. If a duplicate ever appears the
		// chip block is silently lying about coverage.
		const card = await openConfigCard(page);
		const numbers = await card.locator('.nut-card .font-weight-semi-bold').allTextContents();
		const parsed = numbers.map((n) => parseInt(n.trim(), 10));
		expect(new Set(parsed).size).toBe(parsed.length);
	});

	test('minting status pill reflects nut4.disabled', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		const nut4 = nutBlock(info.nuts, 4);
		test.skip(!nut4, 'daemon does not publish nut4 — pill block contract not assertable');

		const card = await openConfigCard(page);
		const expected_text = nut4!.disabled ? 'Minting disabled' : 'Minting enabled';
		await expect(card.getByText(expected_text, {exact: true})).toBeVisible();
	});

	test('minting pill dot carries the active palette when nut4.disabled is false', async ({page}, testInfo) => {
		// Pill dot uses the same `active`/`inactive` palette as the
		// NUT-04 chip — green when minting is on. Asserts the pill
		// graphic and the chip stay coherent (both bound to the same
		// `nut4.disabled` source) so a regression that flips one but
		// not the other surfaces here.
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		const nut4 = nutBlock(info.nuts, 4);
		test.skip(!nut4 || nut4.disabled, 'fixture toggles nut4.disabled — covered in karma');

		const card = await openConfigCard(page);
		const pill = card.getByText('Minting enabled', {exact: true}).locator('..');
		await expect(pill.locator('.indicator-circle')).toHaveClass(/orc-status-active-bg/);
	});

	test('melting status pill reflects nut5.disabled', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		const nut5 = nutBlock(info.nuts, 5);
		test.skip(!nut5, 'daemon does not publish nut5');

		const card = await openConfigCard(page);
		const expected_text = nut5!.disabled ? 'Melting disabled' : 'Melting enabled';
		await expect(card.getByText(expected_text, {exact: true})).toBeVisible();
	});

	test('melting pill dot carries the active palette when nut5.disabled is false', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		const nut5 = nutBlock(info.nuts, 5);
		test.skip(!nut5 || nut5.disabled, 'fixture toggles nut5.disabled — covered in karma');

		const card = await openConfigCard(page);
		const pill = card.getByText('Melting enabled', {exact: true}).locator('..');
		await expect(pill.locator('.indicator-circle')).toHaveClass(/orc-status-active-bg/);
	});

	test('renders one minting-limit row per `nut4.methods[]` entry', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		const nut4 = nutBlock(info.nuts, 4);
		test.skip(!nut4 || nut4.methods.length === 0, 'daemon publishes no nut4 methods — limits column collapses');

		const card = await openConfigCard(page);
		await expect(card.getByText('Minting Limits', {exact: true})).toBeVisible();
		// The two columns share the `.orc-high-card.p-0-5.p-h-1` row class
		// inside `.flex-1`. Scope by the "Minting Limits" caption's parent.
		const minting_col = card.getByText('Minting Limits', {exact: true}).locator('..');
		await expect(minting_col.locator('.limit-range')).toHaveCount(nut4!.methods.length);
	});

	test('renders one melting-limit row per `nut5.methods[]` entry', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		const nut5 = nutBlock(info.nuts, 5);
		test.skip(!nut5 || nut5.methods.length === 0, 'daemon publishes no nut5 methods — limits column collapses');

		const card = await openConfigCard(page);
		await expect(card.getByText('Melting Limits', {exact: true})).toBeVisible();
		const melting_col = card.getByText('Melting Limits', {exact: true}).locator('..');
		await expect(melting_col.locator('.limit-range')).toHaveCount(nut5!.methods.length);
	});

	test('minting-limit row badge matches the daemon method (BOLT 11 etc.)', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		const nut4 = nutBlock(info.nuts, 4);
		test.skip(!nut4 || nut4.methods.length === 0, 'daemon publishes no nut4 methods');

		const card = await openConfigCard(page);
		const minting_col = card.getByText('Minting Limits', {exact: true}).locator('..');
		const badges = minting_col.locator('orc-mint-general-payment-method');
		for (let i = 0; i < nut4!.methods.length; i++) {
			await expect(badges.nth(i)).toContainText(expectedMethodLabel(nut4!.methods[i].method));
		}
	});

	test('melting-limit row badge matches the daemon method (BOLT 11 etc.)', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		const nut5 = nutBlock(info.nuts, 5);
		test.skip(!nut5 || nut5.methods.length === 0, 'daemon publishes no nut5 methods');

		const card = await openConfigCard(page);
		const melting_col = card.getByText('Melting Limits', {exact: true}).locator('..');
		const badges = melting_col.locator('orc-mint-general-payment-method');
		for (let i = 0; i < nut5!.methods.length; i++) {
			await expect(badges.nth(i)).toContainText(expectedMethodLabel(nut5!.methods[i].method));
		}
	});

	test('limit row asset disc class matches the daemon method unit', async ({page}, testInfo) => {
		// Bitcoin units (sat/msat/btc) all map to `graphic-asset-btc`. Live
		// fixtures only emit `sat`, but the assertion is shape-correct for
		// any future unit additions on the same daemon.
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		const nut4 = nutBlock(info.nuts, 4);
		const nut5 = nutBlock(info.nuts, 5);
		test.skip(!nut4 || nut4.methods.length === 0, 'daemon publishes no nut4 methods');

		const card = await openConfigCard(page);
		const minting_col = card.getByText('Minting Limits', {exact: true}).locator('..');
		const minting_assets = minting_col.locator('orc-graphic-asset');
		for (let i = 0; i < nut4!.methods.length; i++) {
			const expected_class = expectedAssetClass(nut4!.methods[i].unit);
			await expect(minting_assets.nth(i).locator('.graphic-asset-unit')).toHaveClass(new RegExp(expected_class));
		}

		if (nut5 && nut5.methods.length > 0) {
			const melting_col = card.getByText('Melting Limits', {exact: true}).locator('..');
			const melting_assets = melting_col.locator('orc-graphic-asset');
			for (let i = 0; i < nut5.methods.length; i++) {
				const expected_class = expectedAssetClass(nut5.methods[i].unit);
				await expect(melting_assets.nth(i).locator('.graphic-asset-unit')).toHaveClass(new RegExp(expected_class));
			}
		}
	});

	test('minting-limit row min/max amounts match the daemon (∞ for null max, 1 for null min)', async ({page}, testInfo) => {
		// nutshell publishes both bounds as null ⇒ rendered as "1" / "∞".
		// cdk publishes 1 / 500_000 ⇒ rendered as the formatted number.
		// `amountFromText` strips formatting so the assertion is locale- and
		// glyph/code-currency-display-independent.
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		const nut4 = nutBlock(info.nuts, 4);
		test.skip(!nut4 || nut4.methods.length === 0, 'daemon publishes no nut4 methods');

		const card = await openConfigCard(page);
		const minting_col = card.getByText('Minting Limits', {exact: true}).locator('..');
		const rows = minting_col.locator('.limit-range');
		for (let i = 0; i < nut4!.methods.length; i++) {
			const {min, max} = await readLimitRow(rows.nth(i));
			expect(min).toBe(expectedMinDisplay(nut4!.methods[i]));
			expect(max).toBe(expectedMaxDisplay(nut4!.methods[i]));
		}
	});

	test('melting-limit row min/max amounts match the daemon (∞ for null max, 1 for null min)', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		const nut5 = nutBlock(info.nuts, 5);
		test.skip(!nut5 || nut5.methods.length === 0, 'daemon publishes no nut5 methods');

		const card = await openConfigCard(page);
		const melting_col = card.getByText('Melting Limits', {exact: true}).locator('..');
		const rows = melting_col.locator('.limit-range');
		for (let i = 0; i < nut5!.methods.length; i++) {
			const {min, max} = await readLimitRow(rows.nth(i));
			expect(min).toBe(expectedMinDisplay(nut5!.methods[i]));
			expect(max).toBe(expectedMaxDisplay(nut5!.methods[i]));
		}
	});

	test('limit row track bars scale each row against the unit max published by the daemon', async ({page}, testInfo) => {
		// `getTrackWidthPercent` scales every bar against the largest
		// `max_amount` in its unit across the union of minting and melting
		// rows: a null row max (or a null/absent unit max) pins the bar to
		// 100%, otherwise width = max/unit_max·100 floored at 5%. Fixtures
		// may publish several methods per unit with different maxes (e.g.
		// cln-cdk-postgres: bolt11 500k + onchain 1M ⇒ 50% and 100%), so
		// expected widths are derived per-row from the daemon's own numbers.
		// Asserting the inline style also guards against a regression that
		// silently leaves the `[style.width.%]` binding unbound.
		const config = getConfig(testInfo.project.name);
		const info = mint.getInfo(config);
		const nut4 = nutBlock(info.nuts, 4);
		const nut5 = nutBlock(info.nuts, 5);
		test.skip(!nut4 || nut4.methods.length === 0, 'daemon publishes no nut4 methods');

		const max_by_unit = new Map<string, number | null>();
		for (const method of [...nut4!.methods, ...(nut5?.methods ?? [])]) {
			const current = max_by_unit.get(method.unit);
			if (method.max_amount === null) max_by_unit.set(method.unit, null);
			else if (current !== null) max_by_unit.set(method.unit, Math.max(current ?? 0, method.max_amount));
		}
		const expectedWidth = (method: MintNutLimitMethod): number => {
			if (method.max_amount === null) return 100;
			const unit_max = max_by_unit.get(method.unit);
			if (unit_max === null || unit_max === undefined || unit_max === 0) return 100;
			return Math.max(5, (method.max_amount / unit_max) * 100);
		};

		const card = await openConfigCard(page);
		const columns: {label: string; methods: MintNutLimitMethod[]}[] = [{label: 'Minting Limits', methods: nut4!.methods}];
		if (nut5 && nut5.methods.length > 0) columns.push({label: 'Melting Limits', methods: nut5.methods});
		for (const column of columns) {
			const bars = card.getByText(column.label, {exact: true}).locator('..').locator('.limit-range-bar');
			for (let i = 0; i < column.methods.length; i++) {
				const style = (await bars.nth(i).getAttribute('style')) ?? '';
				const width = parseFloat(/width:\s*([\d.]+)%/.exec(style)?.[1] ?? 'NaN');
				expect(width).toBeCloseTo(expectedWidth(column.methods[i]), 1);
			}
		}
	});
});
