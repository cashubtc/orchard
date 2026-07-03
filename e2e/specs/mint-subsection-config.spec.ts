/**
 * Feature spec: `orc-mint-subsection-config` — the `/mint/config` page:
 * the operator's NUT-capability control surface.
 *
 * READ-ONLY. Every editable field on this page writes to the operator's
 * live mint config through the event-stack Save flow, and any mint-info
 * -reading sibling spec would drift if we mutated it. So this spec asserts
 * structure and per-stack conditional rendering only — it never confirms a
 * Save, never toggles minting/melting, never edits a limit.
 *
 * Coverage:
 *   - 16 NUT panels render (schema-driven, constant across stacks)
 *   - NUT-04/05 expose the Minting + Melting enabled toggles and quote-TTL
 *     forms
 *   - bolt11 method form present on every LN-backed stack
 *   - bolt12 method form present iff the stack advertises bolt12
 *   - onchain (NUT-30) method form present iff the stack advertises onchain
 *   - supported-NUT status panels render
 *   - mobile viewport collapses the tertiary nav into a Features menu
 *
 * NOT covered (see skip taxonomy in the .md):
 *   - any Save / enabled-toggle / limit mutation (`disruptive`)
 *   - chart pixels (`unit-better`)
 *   - per-NUT detail values (owned by the mint-general-config card spec)
 *   - AI assistant (`stack-only` — cln-cdk-postgres via e2e:test:ai)
 */

import {test, expect, type Page} from '@playwright/test';

import {getConfig} from '@e2e/helpers/config';
import {mint} from '@e2e/helpers/backend';
import type {ConfigInfo} from '@e2e/types/config';

const NUT_PANEL_COUNT = 16;

async function openPage(page: Page): Promise<void> {
	await expect(page.locator('orc-mint-subsection-config-nut').first()).toBeVisible();
}

/** Whether the mint advertises a given payment method on either NUT-04 or
 *  NUT-05 — this is what the config page's `method_index` gates the method
 *  sub-forms on. Read the mint's own /v1/info rather than the stack's LN
 *  capability flags: fake-cdk-postgres's fake_wallet advertises bolt12 +
 *  onchain even though it has no LN backend, so `config.bolt12`/`onchain`
 *  (which describe the LN side) don't predict what the mint publishes. */
function mintAdvertisesMethod(config: ConfigInfo, method: string): boolean {
	const nuts = mint.getInfo(config).nuts as Record<string, unknown>;
	// NUT-06 emits numeric string keys ("4", "5"); some daemons also mirror
	// them as `nut4`/`nut5`. Read both forms the same way the config-card
	// spec's `nutEntries` does.
	const methodsOf = (num: number): Array<{method?: string}> => {
		const block = (nuts[String(num)] ?? nuts[`nut${num}`]) as {methods?: Array<{method?: string}>} | undefined;
		return Array.isArray(block?.methods) ? block!.methods! : [];
	};
	return [...methodsOf(4), ...methodsOf(5)].some((m) => m.method === method);
}

test.describe('mint subsection config — /mint/config', {tag: '@mint'}, () => {
	test.beforeEach(async ({page}) => {
		await page.goto('/mint/config');
	});

	test('renders all 16 NUT panels', async ({page}) => {
		// Schema-driven: the MINT_INFO query selects every nutN field, so the
		// panel set is constant regardless of which subset the daemon
		// actually publishes. A count change here means a NUT was added or
		// removed from the schema.
		await openPage(page);
		await expect(page.locator('orc-mint-subsection-config-nut')).toHaveCount(NUT_PANEL_COUNT);
	});

	test('NUT-04/05 expose the Minting and Melting enabled toggles and TTL forms', async ({page}) => {
		await openPage(page);
		await expect(page.locator('orc-mint-subsection-config-form-enabled')).toHaveCount(2);
		await expect(page.locator('orc-mint-subsection-config-form-quote-ttl')).toHaveCount(2);
	});

	test('bolt11 method forms render on an LN-backed stack', async ({page}, testInfo) => {
		// Every stack in the matrix wires a mint whose sat keyset advertises
		// bolt11, so both the minting and melting bolt11 sub-forms mount.
		const config = getConfig(testInfo.project.name);
		test.skip(config.ln === false, 'no LN backend — bolt11 methods not advertised');
		await openPage(page);
		await expect(page.locator('orc-mint-subsection-config-form-bolt11').first()).toBeVisible();
	});

	test('bolt12 method forms track what the mint advertises', async ({page}, testInfo) => {
		// The bolt12 sub-form renders iff method_index contains a bolt12
		// method. Oracle on the mint's own /v1/info, not the LN-capability
		// flag: cln-cdk-postgres advertises it via a real bolt12 mint+LN,
		// fake-cdk-postgres via its fake_wallet, and the nutshell/lnd stacks
		// don't publish it at all.
		const config = getConfig(testInfo.project.name);
		await openPage(page);
		const bolt12 = page.locator('orc-mint-subsection-config-form-bolt12');
		if (mintAdvertisesMethod(config, 'bolt12')) {
			await expect(bolt12.first()).toBeVisible();
		} else {
			await expect(bolt12).toHaveCount(0);
		}
	});

	test('onchain method forms track what the mint advertises', async ({page}, testInfo) => {
		// NUT-30 onchain mint/melt — advertised by cln-cdk-postgres's bdk
		// backend and by fake-cdk-postgres's fake_wallet. Same /v1/info oracle.
		const config = getConfig(testInfo.project.name);
		await openPage(page);
		const onchain = page.locator('orc-mint-subsection-config-form-onchain');
		if (mintAdvertisesMethod(config, 'onchain')) {
			await expect(onchain.first()).toBeVisible();
		} else {
			await expect(onchain).toHaveCount(0);
		}
	});

	test('supported-NUT status panels render', async ({page}) => {
		await openPage(page);
		await expect(page.locator('orc-mint-subsection-config-nut-supported').first()).toBeVisible();
	});
});

test.describe('mint subsection config — mobile viewport', {tag: '@canary'}, () => {
	test.use({viewport: {width: 375, height: 812}});

	test('mobile collapses the tertiary nav into a Features menu', async ({page}) => {
		await page.goto('/mint/config');
		await expect(page.locator('orc-mint-subsection-config-nut').first()).toBeVisible();
		const features = page.locator('.mobile-mint-config-nav button', {hasText: 'Features'});
		await expect(features).toBeVisible();
		await features.click();
		await expect(page.locator('.cdk-overlay-container .mat-mdc-menu-panel')).toBeVisible();
		await page.keyboard.press('Escape');
	});
});
