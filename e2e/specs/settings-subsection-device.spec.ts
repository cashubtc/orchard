/**
 * Feature spec: `/settings/device` SAVE round-trips for the device settings
 * cards that settings-subsections.spec.ts leaves untested (it asserts the
 * theme + card rendering only). Covered here: locale, timezone, bitcoin/fiat
 * currency display, and the AI model card's gating.
 *
 * Persistence model (the differential): device settings never touch the
 * server. Each change fires the card's change-handler → parent `on*Change`
 * → `LocalStorageService` write (keys below) + a SAVING→SUCCESS event pair
 * whose '<Thing> updated!' message renders in the toast surface. The oracle
 * is therefore window.localStorage itself plus the setting's visible effect
 * (the card's live example re-formats):
 *
 *   locale   → `v0.setting.locale`   {code}  → example amount re-formats to
 *              Intl.NumberFormat(locale) digits (the same ICU tables Angular
 *              uses, so the expected string is COMPUTED, never hard-coded)
 *   timezone → `v0.setting.timezone` {tz}    → example timestamp re-renders
 *   currency → `v0.setting.currency` {type_btc, type_fiat} → ₿ glyph ↔ "sat"
 *              (btc) / symbol ↔ ISO code (fiat) in the example amount
 *   model    → `v0.setting.model`    {model} — @ai only (options come from
 *              the live ollama vendor)
 *
 * Suite-green: localStorage mutations live and die with the test's browser
 * context — every test starts from the storageState snapshot settings.setup
 * wrote, so no cleanup dance is needed and reruns are trivially green. The
 * pristine-matrix test doubles as the regression net for settings.setup
 * itself (it asserts the seeded stack matrix actually landed).
 *
 * Deliberately NOT covered:
 *   - theme toggle (already asserted against the stack matrix in
 *     settings-subsections.spec.ts).
 *   - categories card (`dead-branch` — declared but not mounted by the
 *     current /settings/device template).
 *   - exact timestamp strings for the timezone example (`unit-better` —
 *     locale × zone formatting matrix belongs to Karma; the delta assert +
 *     localStorage oracle here proves the wiring).
 */

import {test, expect, type Locator, type Page} from '@playwright/test';

import {getConfig} from '@e2e/helpers/config';
import {orchard} from '@e2e/helpers/backend';
import {applyLocale, applyTimezone, applyCurrency} from '@e2e/helpers/ui/settings';
import type {ConfigInfo} from '@e2e/types/config';

/** SUCCESS / ERROR toast surface. */
function eventToast(page: Page): Locator {
	return page.locator('orc-event-general-stack orc-event-general-stack-message .event-message-content');
}

/** Parsed localStorage value, or null when unset. */
async function storedJson<T>(page: Page, key: string): Promise<T | null> {
	const raw = await page.evaluate((k) => localStorage.getItem(k), key);
	return raw === null ? null : (JSON.parse(raw) as T);
}

/** The card's live example element (each card marks it with #flash — locale
 *  and currency render a `span.font-size-m`, timezone a `.w-min-12.text-center`
 *  div). Scoped tight so the "Sync with device" checkbox label can't match. */
function exampleOf(card: Locator): Locator {
	return card.locator('.w-min-12.text-center, span.font-size-m').last();
}

/** A probe locale guaranteed to differ from the seeded one, with grouping
 *  digits that survive innerText normalization (avoid narrow-NBSP locales). */
function probeLocale(config: ConfigInfo): string {
	return config.deviceSettings?.locale === 'de-DE' ? 'en-GB' : 'de-DE';
}

function probeTimezone(config: ConfigInfo): string {
	return config.deviceSettings?.timezone === 'Pacific/Auckland' ? 'America/Denver' : 'Pacific/Auckland';
}

test.describe('settings device — save round-trips', {tag: '@all'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/settings/device', {waitUntil: 'networkidle'});
		await expect(page.locator('orc-settings-subsection-device-locale')).toBeVisible();
	});

	test('the seeded device-settings matrix actually landed in localStorage (settings.setup regression net)', async ({
		page,
	}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const seeded = config.deviceSettings ?? {};
		test.skip(Object.keys(seeded).length === 0, 'stack seeds no device settings (canary runs on defaults)');

		if (seeded.locale) {
			expect(await storedJson<{code: string}>(page, 'v0.setting.locale')).toEqual({code: seeded.locale});
		}
		if (seeded.timezone) {
			expect(await storedJson<{tz: string}>(page, 'v0.setting.timezone')).toEqual({tz: seeded.timezone});
		}
		if (seeded.currency_btc || seeded.currency_fiat) {
			// A seed equal to the app default (glyph/glyph) is a select no-op —
			// mat-select fires no selectionChange, nothing is written — so
			// compare EFFECTIVE values (stored ?? default), which is exactly
			// what `LocalStorageService.getCurrency()` hands the app.
			const stored = await storedJson<{type_btc: string; type_fiat: string}>(page, 'v0.setting.currency');
			if (seeded.currency_btc) expect(stored?.type_btc ?? 'glyph').toBe(seeded.currency_btc);
			if (seeded.currency_fiat) expect(stored?.type_fiat ?? 'glyph').toBe(seeded.currency_fiat);
		}
		if (seeded.theme) {
			expect(await storedJson<{type: string}>(page, 'v0.setting.theme')).toEqual({type: seeded.theme});
		}
	});

	test('locale change persists to localStorage and re-formats the example amount per ICU', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const probe = probeLocale(config);

		await applyLocale(page, probe);
		// The event stack renders the message once per mounted surface
		// (desktop + mobile nav both mount one) — assert the first.
		await expect(eventToast(page).filter({hasText: 'Locale updated!'}).first()).toBeVisible();

		expect(await storedJson<{code: string}>(page, 'v0.setting.locale')).toEqual({code: probe});

		// The card's example amount (1,500,000 sats) re-renders through the
		// locale-aware pipe — its digit grouping must match what ICU produces
		// for the probe locale. Computed expectation, not a hard-coded string,
		// so the assert is locale-table-proof.
		const expected_digits = new Intl.NumberFormat(probe).format(1_500_000);
		const example = exampleOf(page.locator('orc-settings-subsection-device-locale'));
		await expect(example).toContainText(expected_digits);
	});

	test('timezone change persists to localStorage and re-renders the example timestamp', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const probe = probeTimezone(config);

		const example = exampleOf(page.locator('orc-settings-subsection-device-timezone'));
		const before = ((await example.textContent()) ?? '').trim();
		expect(before.length, 'timezone card should render an example timestamp').toBeGreaterThan(0);

		await applyTimezone(page, probe);
		await expect(eventToast(page).filter({hasText: 'Timezone updated!'}).first()).toBeVisible();

		expect(await storedJson<{tz: string}>(page, 'v0.setting.timezone')).toEqual({tz: probe});

		// The probe zones sit hours apart from every seeded zone, so the
		// rendered example must change (exact string is locale-dependent —
		// the delta plus the localStorage oracle proves the wiring).
		await expect(example).not.toHaveText(before);
	});

	test('bitcoin + fiat display toggles persist and swap the example between glyph and code', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const seeded_btc = config.deviceSettings?.currency_btc ?? 'glyph';
		const seeded_fiat = config.deviceSettings?.currency_fiat ?? 'glyph';
		const probe_btc = seeded_btc === 'glyph' ? 'code' : 'glyph';
		const probe_fiat = seeded_fiat === 'glyph' ? 'code' : 'glyph';

		await applyCurrency(page, 'btc', probe_btc);
		await expect(eventToast(page).filter({hasText: 'Currency updated!'}).first()).toBeVisible();
		let stored = await storedJson<{type_btc: string; type_fiat: string}>(page, 'v0.setting.currency');
		expect(stored?.type_btc).toBe(probe_btc);

		// The bitcoin example renders ₿ under glyph and the word "sat" under
		// code — the two cards are the two orc-…-currency instances in order.
		const btc_example = exampleOf(page.locator('orc-settings-subsection-device-currency').first());
		if (probe_btc === 'code') await expect(btc_example).toContainText('sat');
		else await expect(btc_example).toContainText('₿');

		await applyCurrency(page, 'fiat', probe_fiat);
		stored = await storedJson<{type_btc: string; type_fiat: string}>(page, 'v0.setting.currency');
		expect(stored?.type_fiat).toBe(probe_fiat);

		const fiat_example = exampleOf(page.locator('orc-settings-subsection-device-currency').nth(1));
		if (probe_fiat === 'code') await expect(fiat_example).toContainText('USD');
		else await expect(fiat_example).toContainText('$');
	});

	test('AI model card gates on the ai.enabled app setting', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const ai_enabled = orchard.setting(config, 'ai.enabled') === 'true';

		const card = page.locator('orc-settings-subsection-device-ai');
		if (ai_enabled) {
			// Enabled: the model autocomplete renders (options need a live
			// ollama and are exercised by the @ai round-trip below).
			await expect(card.locator('input[aria-label="Model"]')).toBeVisible();
		} else {
			// Disabled: the card body is replaced by the AI DISABLED overlay.
			await expect(card.getByText(/AI DISABLED/i)).toBeVisible();
		}
	});
});

test.describe('settings device — AI model round-trip', {tag: '@ai'}, () => {
	test('re-selecting the configured model fires the save and persists to localStorage', async ({page}, testInfo) => {
		const config = getConfig(testInfo.project.name);
		const model = config.deviceSettings?.ai_model;
		test.skip(!model, 'no ai_model in this run (AI_MODEL env not injected)');

		await page.goto('/settings/device', {waitUntil: 'networkidle'});
		const card = page.locator('orc-settings-subsection-device-ai');
		const input = card.locator('input[aria-label="Model"]');
		await expect(input).toBeVisible();

		// Selecting the (already-configured) model from the live-ollama
		// autocomplete still emits optionSelected → onModelChange → persist,
		// so the save path is proven without drifting the device settings the
		// other @ai specs rely on.
		await input.fill(model!);
		const option = page.locator('mat-option').filter({hasText: model!});
		await expect(option, `AI_MODEL "${model}" should be present in the ollama autocomplete`).toHaveCount(1);
		await option.click();

		await expect(eventToast(page).filter({hasText: 'Model updated!'}).first()).toBeVisible();
		const stored = await page.evaluate(() => localStorage.getItem('v0.setting.model'));
		expect(JSON.parse(stored ?? 'null')).toEqual({model});
	});
});
