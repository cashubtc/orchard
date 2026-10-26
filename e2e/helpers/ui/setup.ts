import {type Page, type TestInfo, expect} from '@playwright/test';
import {TEST_ADMIN, getConfig} from '@e2e/helpers/config';
import type {ConfigInfo} from '@e2e/types/config';

/** Setup-tier project name is `<prefix>-<config>:<port>` — strip both to
 *  recover the bare config name. */
function bareConfigName(testInfo: TestInfo, prefix: 'setup' | 'settings'): string {
	return testInfo.project.name.replace(new RegExp(`^${prefix}-`), '').replace(/:\d+$/, '');
}

export function projectConfig(testInfo: TestInfo, prefix: 'setup' | 'settings'): ConfigInfo {
	return getConfig(bareConfigName(testInfo, prefix));
}

export function projectStatePath(testInfo: TestInfo, prefix: 'setup' | 'settings'): string {
	return `e2e/.auth/${bareConfigName(testInfo, prefix)}.json`;
}

/**
 * Call once per compose-stack lifetime. The uninitializedGuard redirects
 * `/` → `/auth/setup` only when no admin exists; a second call against the
 * same stack will throw because the setup route will no longer render.
 */
export async function completeSetup(page: Page, config: ConfigInfo): Promise<void> {
	await page.goto('/');
	await expect(page).toHaveURL(/\/auth\/setup$/);

	await page.getByLabel('Setup Key').fill(config.setupKey);
	await page.getByLabel('Username').fill(TEST_ADMIN.name);
	await page.getByLabel('Password', {exact: true}).fill(TEST_ADMIN.password);
	await page.getByLabel('Confirm Password').fill(TEST_ADMIN.password);

	await page.getByRole('button', {name: /start/i}).click();
	await expect(page).toHaveURL(/\/onboarding\/services(?:\?.*)?$/);
	await page.getByRole('button', {name: 'Skip for now', exact: true}).click();
	await expect(page).not.toHaveURL(/\/onboarding/);
}
