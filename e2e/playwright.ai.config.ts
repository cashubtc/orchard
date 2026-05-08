/**
 * Playwright config for AI feature tests. Targets the `cln-cdk-postgres` stack
 * only (the sole stack with `ai.enabled = true`). Runs single-threaded and with
 * a higher timeout to accommodate Ollama inference latency.
 *
 * Usage:
 *   npm run e2e:test:ai
 *
 * The stack must already be running (`npm run e2e:up cln-cdk-postgres`) and
 * Ollama must be reachable at `http://host.docker.internal:11434`.
 *
 * Spec files tag AI tests with `{tag: '@ai'}`. The setup/settings projects use
 * the full stack grep (same as the main config) so auth and settings initialise
 * correctly before specs run.
 */

import dotenv from 'dotenv';

import {defineConfig, devices, type Project} from '@playwright/test';
import {CONFIGS, portOf, tagsFor} from './helpers/config';
import type {ConfigInfo} from './types/config';

dotenv.config({path: './e2e/.env', quiet: true});

function grepFor(config: ConfigInfo): RegExp {
	return new RegExp(
		tagsFor(config)
			.map((t) => `(${t})`)
			.join('|'),
	);
}

const base = CONFIGS['cln-cdk-postgres'];
const config: ConfigInfo = process.env.AI_MODEL
	? {...base, deviceSettings: {...base.deviceSettings, ai_model: process.env.AI_MODEL}}
	: base;
const baseURL = config.orchardUrl;
const storageState = `e2e/.auth/${config.name}.json`;
const projectName = `${config.name}:${portOf(config)}`;
const setupName = `setup-${projectName}`;
const settingsName = `settings-${projectName}`;

const projects: Project[] = [
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
		name: projectName,
		testDir: './specs',
		testMatch: /.*\.spec\.ts$/,
		dependencies: [settingsName],
		grep: /@ai/,
		use: {...devices['Desktop Chrome'], baseURL, storageState},
	},
];

export default defineConfig({
	tsconfig: './tsconfig.json',
	outputDir: './test-results',
	timeout: 60_000,
	expect: {timeout: 10_000},
	forbidOnly: !!process.env.CI,
	retries: 0,
	workers: 1,
	reporter: [['list']],
	use: {
		trace: 'retain-on-failure',
		screenshot: {mode: 'only-on-failure', fullPage: true},
	},
	projects,
});
