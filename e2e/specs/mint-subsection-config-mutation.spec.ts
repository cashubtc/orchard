/**
 * Mutation spec: `/mint/config` REAL per-field saves, driven through the UI
 * and verified against the mint daemon's own truth.
 *
 * The structural sibling (mint-subsection-config.spec.ts) is explicitly
 * read-only — it never confirms a save. This is the write complement: it
 * edits each advertised method's min-amount limit (bolt11, and where the
 * daemon advertises them, bolt12 + onchain) plus, on cdk stacks, a quote TTL,
 * commits via the per-field save, and asserts the daemon reflects the change,
 * then reverts so the shared mint is left pristine for sibling specs
 * (mint-subsection-info, mint-general-config card, the structural config spec
 * all read this same `/v1/info`).
 *
 * Per-field save mechanism (from the child forms): typing into a limit /
 * TTL input and pressing Enter fires `onSubmit` → the parent registers a
 * SAVING event and calls the single-field mutation directly
 * (`MintNut04Update` / `MintQuoteTtl`); on success it registers a SUCCESS
 * event whose 'Configuration updated!' message renders in the toast surface.
 *
 * Oracles:
 *   - min/max limits live in NUT-06 `/v1/info` on every mint impl →
 *     `mint.getInfo(config, {fresh:true}).nuts['4'].methods` — the universal,
 *     all-stacks differential.
 *   - quote TTLs are NOT in `/v1/info`; cdk-mintd persists them in `kv_store`
 *     → `mint.getQuoteTtl(config, {fresh:true})` (cdk only). The TTL test
 *     gates to cdk stacks.
 *
 * Suite-green: every edit is reverted within the same test (edit → assert →
 * revert → assert-restored), mirroring mint-subsection-info.spec.ts, so the
 * daemon ends byte-identical to how the test found it and reruns stay green.
 *
 * Deliberately NOT covered here:
 *   - the Minting/Melting enabled toggle (disables the mint mid-run; a mid-
 *     test failure between OFF and ON would break every sibling mint spec on
 *     the shared daemon — too sharp an edge for the value; the per-field
 *     limit save already exercises the save→mutation→/v1/info path).
 *   - the bulk BulkMintUpdate chip path (would commit any other dirty field).
 *   - AI config assistant (`stack-only` — cln-cdk-postgres via e2e:test:ai).
 */

import {test, expect, type Locator, type Page} from '@playwright/test';

import {getConfig} from '@e2e/helpers/config';
import {mint} from '@e2e/helpers/backend';
import {matchGql} from '@e2e/helpers/ui/gql-intercept';
import type {ConfigInfo} from '@e2e/types/config';

/** The global event chip — one visible per viewport. */
function eventChip(page: Page): Locator {
	return page.locator('orc-event-general-nav-tool:visible').first();
}

/** SUCCESS / ERROR toast surface. */
function eventToast(page: Page): Locator {
	return page.locator('orc-event-general-stack orc-event-general-stack-message .event-message-content');
}

/** The minting or melting sub-form for a payment method, found through its
 *  sticky section header — the page pairs one section per unit+method and only
 *  bolt11/onchain still have a dedicated wrapper component to select on. */
function methodForm(page: Page, unit: string, label: string, nut: 4 | 5): Locator {
	const section = page
		.locator('.sticky-config')
		.filter({hasText: new RegExp(`^${unit} Configuration`, 'i')})
		.filter({hasText: label})
		.nth(nut === 4 ? 0 : 1);
	return section.locator('xpath=following-sibling::div[contains(@class,"nut-wrapper")][1]');
}

/** Clean drive of a Material input so ReactiveForms sees `input` in the right
 *  focus/blur order. Click → select-all → delete → type. */
async function typeInto(field: Locator, value: string): Promise<void> {
	await field.click();
	await field.press('ControlOrMeta+a');
	await field.press('Delete');
	if (value.length > 0) await field.pressSequentially(value, {delay: 0});
}

/** The daemon's advertised min/max for one unit and payment method, read
 *  straight from `/v1/info`. Numeric-string keys ('4'), same accessor the
 *  config-card spec uses. Null when the mint doesn't advertise the method —
 *  the caller's skip gate (e.g. bolt12 on lnd stacks, onchain on nutshell). */
function nutMethod(
	config: ConfigInfo,
	method: string,
	unit: string,
	nut: 4 | 5,
	opts: {fresh?: boolean} = {},
): {min_amount: number; max_amount: number} | null {
	const nuts = mint.getInfo(config, opts).nuts as Record<
		string,
		{methods?: Array<{method?: string; unit?: string; min_amount?: number; max_amount?: number}>}
	>;
	const methods = nuts[String(nut)]?.methods ?? [];
	const m = methods.find((x) => x.method === method && x.unit === unit);
	if (!m) return null;
	return {min_amount: m.min_amount ?? 0, max_amount: m.max_amount ?? 0};
}

async function openConfig(page: Page): Promise<void> {
	// The config page mounts 16 NUT panels + charts — heavy, and slow to
	// settle when several stacks load mint pages at once. Give the first
	// panel extra room beyond the 5s default.
	await expect(page.locator('orc-mint-subsection-config-nut').first()).toBeVisible({timeout: 20_000});
}

test.describe('mint config mutation — /mint/config', {tag: '@mint'}, () => {
	test.describe.configure({mode: 'serial'});

	test.beforeEach(async ({page}) => {
		await page.goto('/mint/config');
		await openConfig(page);
	});

	// One min-amount round-trip per payment method. All three fire the SAME
	// per-field save path (Enter → onSubmit → MintNut04Update with a `method`
	// arg), but each renders in its own sub-form component, gated on the mint
	// advertising the method in `/v1/info`:
	//   bolt11  — every cdk stack
	//   bolt12  — cln-cdk (real CLN offers) + fake-cdk (fake_wallet)
	//   onchain — cln-cdk + lnd-cdk (BDK backend) + fake-cdk (fake_wallet)
	// The runtime skip reads the daemon itself, so the matrix self-adjusts.
	for (const scenario of [
		{nut: 4, unit: 'sat', method: 'bolt11', label: 'Bolt 11'},
		{nut: 4, unit: 'sat', method: 'bolt12', label: 'Bolt 12'},
		{nut: 4, unit: 'sat', method: 'onchain', label: 'Onchain'},
		{nut: 4, unit: 'ora', method: 'branch', label: 'branch'},
		{nut: 5, unit: 'ora', method: 'branch', label: 'branch'},
	] as const) {
		test(`editing NUT-0${scenario.nut} ${scenario.unit}/${scenario.method} min amount round-trips to the daemon and reverts`, async ({
			page,
		}, testInfo) => {
			const config = getConfig(testInfo.project.name);
			// Only cdk mints publish concrete, revertible min/max bounds in
			// `/v1/info`; nutshell omits the keys entirely (renders the form's
			// default 1/∞ with nothing persisted to edit or revert cleanly).
			test.skip(config.mint !== 'cdk', 'min/max limits are only concrete + revertible on cdk mints');
			const before = nutMethod(config, scenario.method, scenario.unit, scenario.nut, {fresh: true});
			test.skip(before === null, `mint does not advertise a ${scenario.unit}/${scenario.method} NUT-0${scenario.nut} method`);
			// A value that stays a valid integer strictly below max_amount so the
			// form's `minGreaterThan`/integer validators pass and the save fires.
			const probe = before!.min_amount + 1;
			expect(probe, 'probe min must stay below the daemon max').toBeLessThan(before!.max_amount);

			// Scope to the sat section for this method: the page renders one
			// section per unit+method pair, and stacks advertise the same
			// methods under more than one unit. Within that, the minting
			// (NUT-04) block comes first — NUT-05 melting renders its own later.
			const minInput = methodForm(page, scenario.unit, scenario.label, scenario.nut).locator(
				'orc-mint-subsection-config-form-min input[matInput]',
			);
			await expect(minInput).toBeVisible();

			try {
				await typeInto(minInput, String(probe));
				// Per-field save: Enter fires onSubmit → MintNut04Update.
				const save = page.waitForResponse(matchGql(`MintNut0${scenario.nut}Update`));
				await minInput.press('Enter');
				await save;
				await expect(eventToast(page).filter({hasText: 'Configuration updated!'})).toBeVisible();

				// Backend truth: the daemon's advertised min is now the probe.
				expect(nutMethod(config, scenario.method, scenario.unit, scenario.nut, {fresh: true})!.min_amount).toBe(probe);
			} finally {
				// Revert to the original min so the shared daemon is left pristine —
				// re-read fresh and only save if still drifted (idempotent on retry).
				if (nutMethod(config, scenario.method, scenario.unit, scenario.nut, {fresh: true})!.min_amount !== before!.min_amount) {
					await typeInto(minInput, String(before!.min_amount));
					const restore = page.waitForResponse(matchGql(`MintNut0${scenario.nut}Update`));
					await minInput.press('Enter');
					await restore;
					await expect(eventToast(page).filter({hasText: 'Configuration updated!'})).toBeVisible();
				}
			}

			// Backend truth restored.
			expect(nutMethod(config, scenario.method, scenario.unit, scenario.nut, {fresh: true})!.min_amount).toBe(before!.min_amount);
		});
	}

	test('editing the mint quote TTL round-trips to cdk kv_store and reverts', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		// TTL persists in cdk-mintd's kv_store; nutshell has no such store.
		test.skip(config.mint !== 'cdk', 'quote TTL is only persisted (and oracle-readable) on cdk mints');

		const before = mint.getQuoteTtl(config, {fresh: true});
		expect(before.mint_ttl, 'cdk should expose a mint_ttl').not.toBeNull();
		const probe = before.mint_ttl! + 60;

		// The mint (NUT-04) quote-ttl form is the first quote-ttl form; melt is
		// the second. The input DISPLAY is locale-formatted (e.g. de-DE renders
		// 3600 as "3.600"), so don't assert on its value string — type the raw
		// integer (the form parses it) and pivot on the kv_store oracle.
		const ttlInput = page.locator('orc-mint-subsection-config-form-quote-ttl').first().locator('input[matInput]');
		await expect(ttlInput).toBeVisible();

		try {
			await typeInto(ttlInput, String(probe));
			const save = page.waitForResponse(matchGql('MintQuoteTtl'));
			await ttlInput.press('Enter');
			await save;
			await expect(eventToast(page).filter({hasText: 'Configuration updated!'})).toBeVisible();

			// Backend truth: kv_store now holds the probe mint_ttl.
			expect(mint.getQuoteTtl(config, {fresh: true}).mint_ttl).toBe(probe);
		} finally {
			if (mint.getQuoteTtl(config, {fresh: true}).mint_ttl !== before.mint_ttl) {
				await typeInto(ttlInput, String(before.mint_ttl));
				const restore = page.waitForResponse(matchGql('MintQuoteTtl'));
				await ttlInput.press('Enter');
				await restore;
				await expect(eventToast(page).filter({hasText: 'Configuration updated!'})).toBeVisible();
			}
		}

		expect(mint.getQuoteTtl(config, {fresh: true}).mint_ttl).toBe(before.mint_ttl);
	});
});
