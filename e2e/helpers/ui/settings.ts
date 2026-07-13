/**
 * Per-stack settings setup — drives `/settings/app` and `/settings/device`
 * (no GraphQL shortcuts) so the result lands in the same auth storage file.
 * Undefined config fields are skipped, leaving server/system defaults.
 * One documented exception: `mint_metrics_api` goes through GraphQL because
 * it has no settings card yet — see `applyMintMetricsApi`.
 *
 * App toggles register a PENDING event and only persist on a commit click;
 * `applyAppSettings` batches its toggles and commits once at the end. Device
 * settings save synchronously to localStorage per change.
 */

import {expect, type Locator, type Page} from '@playwright/test';
import {gql} from '@e2e/helpers/ui/gql';
import type {AppSettingValues, ConfigInfo, DeviceSettingValues} from '@e2e/types/config';

/** Click the form-toggle inside `card` whose visible label matches. Sibling
 *  toggles render identical templates — scoping to the card is enough. */
async function clickToggle(card: Locator, label: string): Promise<void> {
	await card.locator('orc-form-toggle').filter({hasText: label}).click();
}

async function applyOracleToggle(page: Page, enabled: boolean): Promise<void> {
	const card = page.locator('orc-settings-subsection-app-bitcoin-oracle');
	await clickToggle(card, enabled ? 'Enabled' : 'Disabled');
}

async function applyAiEnabledToggle(page: Page, enabled: boolean): Promise<void> {
	const card = page.locator('orc-settings-subsection-app-ai-integration');
	await clickToggle(card, enabled ? 'Enabled' : 'Disabled');
}

/** Tabs are gated on AI enabled; caller must toggle AI on first. `ollama` is
 *  the default tab — only the openrouter switch is observable. */
async function applyAiVendor(page: Page, vendor: 'ollama' | 'openrouter'): Promise<void> {
	if (vendor === 'ollama') return;
	const card = page.locator('orc-settings-subsection-app-ai-integration');
	await card.getByRole('tab', {name: /openrouter/i}).click();
}

/** Don't press Enter — that fires the field's own (ngSubmit) and bypasses the
 *  form-level pending event. We want the value to ride the batch commit. */
async function applyAiOllamaApi(page: Page, value: string): Promise<void> {
	const card = page.locator('orc-settings-subsection-app-ai-integration');
	const input = card.locator('input[aria-label="Ollama API Endpoint"]');
	await input.fill(value);
}

/** ******************************************************************
 *  TEMPORARY GRAPHQL SHORTCUT — REPLACE WITH A REAL UI DRIVE.
 *  `mint.metrics.api` has NO settings-UI surface on this branch, so the
 *  flip goes straight through the admin `settings_update` mutation. The
 *  NEXT branch adds the metrics settings components — when they land,
 *  delete this function and drive the card on /settings/app like every
 *  other app setting (this file's header rule is "no GraphQL shortcuts";
 *  this is the one documented exception until the UI exists).
 ****************************************************************** */
async function applyMintMetricsApi(page: Page, value: string): Promise<void> {
	await gql(
		page,
		`mutation E2eSetMintMetricsApi($keys: [SettingKey!]!, $values: [String!]!) {
			settings_update(keys: $keys, values: $values) { key value }
		}`,
		{keys: ['MINT_METRICS_API'], values: [value]},
	);
}

/** Click either visible nav-tool (desktop + mobile both render) to commit the
 *  PENDING save; wait for the highlight to clear before returning. */
async function commitPendingAppSettings(page: Page): Promise<void> {
	const highlighted = page.locator('.event-nav-tool.nav-tool-highlight').first();
	await expect(highlighted).toBeVisible();
	await highlighted.click();
	await expect(page.locator('.event-nav-tool.nav-tool-highlight')).toHaveCount(0);
}

async function applyAppSettings(page: Page, app: AppSettingValues): Promise<void> {
	let dirty = false;
	if (app.bitcoin_oracle !== undefined) {
		await applyOracleToggle(page, app.bitcoin_oracle);
		dirty = true;
	}
	if (app.ai_enabled !== undefined) {
		await applyAiEnabledToggle(page, app.ai_enabled);
		dirty = true;
	}
	if (app.ai_vendor) {
		await applyAiVendor(page, app.ai_vendor);
		dirty = true;
	}
	if (app.ai_ollama_api) {
		await applyAiOllamaApi(page, app.ai_ollama_api);
		dirty = true;
	}
	// GraphQL write — registers no PENDING chip, so it must NOT mark dirty:
	// on a stack whose only app setting is mint_metrics_api the commit click
	// would fail waiting for a highlight that never appears.
	if (app.mint_metrics_api !== undefined) {
		await applyMintMetricsApi(page, app.mint_metrics_api);
	}
	if (dirty) await commitPendingAppSettings(page);
}

async function applyTheme(page: Page, theme: 'dark-mode' | 'light-mode'): Promise<void> {
	const card = page.locator('orc-settings-subsection-device-theme');
	await clickToggle(card, theme === 'light-mode' ? 'Light theme' : 'Dark theme');
}

/** Drive a "Sync with device + combobox" card. Sync defaults checked when no
 *  value is stored; the change-handler ignores values matching the system, so
 *  we uncheck it for a deterministic value regardless of the runner's env.
 *
 *  Click the exact filtered mat-option — NEVER blind-Enter. Enter without an
 *  active option commits nothing, and the card silently keeps the runner's
 *  device value (this is how a seeded 'UTC' — absent from V8's timezone
 *  list — left fake-cdk-postgres running on the host's zone for weeks).
 *  Loud-fail instead when the requested value isn't offered. */
async function applySyncedComboField(card: Locator, value: string): Promise<void> {
	const sync = card.getByRole('checkbox', {name: /sync with device/i});
	if (await sync.isChecked()) await sync.uncheck();
	const input = card.getByRole('combobox');
	await input.fill(value);
	// Timezone options are the bare value; locale options are "code - Country"
	// — anchor on the leading token for both.
	const option = card
		.page()
		.locator('mat-option')
		.filter({hasText: new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)})
		.first();
	await expect(option, `"${value}" is not offered by this combobox — fix the stack's deviceSettings matrix`).toBeVisible();
	await option.click();
}

export async function applyLocale(page: Page, locale: string): Promise<void> {
	await applySyncedComboField(page.locator('orc-settings-subsection-device-locale'), locale);
}

export async function applyTimezone(page: Page, tz: string): Promise<void> {
	await applySyncedComboField(page.locator('orc-settings-subsection-device-timezone'), tz);
}

const CURRENCY_OPTION_DETAILS: Record<'btc' | 'fiat', Record<'code' | 'glyph', RegExp>> = {
	btc: {
		glyph: /Bitcoin symbol per bip 177/i,
		code: /Sats displayed with the word sat/i,
	},
	fiat: {
		glyph: /Fiat currency symbol/i,
		code: /Fiat currency code/i,
	},
};

/** Open the mat-select inside the "Bitcoin display" or "Fiat display" card
 *  and click the option whose helper text matches the requested currency. */
export async function applyCurrency(page: Page, mode: 'btc' | 'fiat', currency: 'code' | 'glyph'): Promise<void> {
	const heading = mode === 'btc' ? 'Bitcoin display' : 'Fiat display';
	const wrapper = page.locator('.flex-1', {hasText: heading});
	const card = wrapper.locator('orc-settings-subsection-device-currency');
	await card.getByRole('combobox').click();
	await page.getByRole('option', {name: CURRENCY_OPTION_DETAILS[mode][currency]}).click();
}

/** Select an AI model from the mat-autocomplete on the device settings page.
 *  Requires AI to be enabled (app setting) before this page load or the card
 *  won't render. Asserts the option exists (loud-fail if `AI_MODEL` isn't
 *  pulled into ollama on this stack) and that the input commits the value. */
async function applyAiModel(page: Page, model: string): Promise<void> {
	const card = page.locator('orc-settings-subsection-device-ai');
	const input = card.locator('input[aria-label="Model"]');
	await input.fill(model);
	const option = page.locator('mat-option').filter({hasText: model});
	await expect(option, `AI_MODEL "${model}" not present in ollama autocomplete on this stack`).toHaveCount(1);
	await option.click();
	await expect(input, `AI_MODEL "${model}" did not commit to the model input`).toHaveValue(model);
}

async function applyDeviceSettings(page: Page, device: DeviceSettingValues): Promise<void> {
	if (device.theme) await applyTheme(page, device.theme);
	if (device.timezone) await applyTimezone(page, device.timezone);
	if (device.locale) await applyLocale(page, device.locale);
	if (device.currency_btc) await applyCurrency(page, 'btc', device.currency_btc);
	if (device.currency_fiat) await applyCurrency(page, 'fiat', device.currency_fiat);
	if (device.ai_model) await applyAiModel(page, device.ai_model);
}

/** Drive `/settings/app` then `/settings/device` per the config's matrix.
 *  Skips either page when the corresponding shape is unset (canary's case). */
export async function applySettings(page: Page, config: ConfigInfo): Promise<void> {
	const app = config.appSettings;
	const device = config.deviceSettings;

	if (app && Object.keys(app).length > 0) {
		await page.goto('/settings/app', {waitUntil: 'networkidle'});
		await applyAppSettings(page, app);
	}
	if (device && Object.keys(device).length > 0) {
		await page.goto('/settings/device', {waitUntil: 'networkidle'});
		await applyDeviceSettings(page, device);
	}
}
