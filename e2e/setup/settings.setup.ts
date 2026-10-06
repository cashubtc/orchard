/**
 * Per-project settings setup. Runs after `auth.setup.ts` and before specs —
 * drives `/settings/app` and `/settings/device` to apply the per-stack matrix
 * declared on each config, then persists the augmented state back into the
 * same `e2e/.auth/<config>.json` storage file. Tagged `@all` so canary runs
 * it too (a fast no-op there since canary leaves all settings unset).
 */

import {test as setup} from '@playwright/test';
import {applyReserveSources, applySettings, DEFAULT_RESERVE_SOURCES} from '@e2e/helpers/ui/settings';
import {projectConfig, projectStatePath} from '@e2e/helpers/ui/setup';

setup('apply app + device settings', {tag: '@all'}, async ({page}, testInfo) => {
	await applySettings(page, projectConfig(testInfo, 'settings'));
	await page.context().storageState({path: projectStatePath(testInfo, 'settings')});
});

// Balance-sheet specs read assets off the default sources; a selection left
// over from manual QA or an aborted mutation spec would skew them.
setup('reset mint reserve sources to the defaults', {tag: '@all'}, async ({page}) => {
	await page.goto('/');
	await applyReserveSources(page, DEFAULT_RESERVE_SOURCES);
});
