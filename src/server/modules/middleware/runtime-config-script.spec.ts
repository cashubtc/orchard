import {spawnSync} from 'node:child_process';
import {mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, copyFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';

describe('runtime configuration startup script', () => {
	let directory: string;
	let env: NodeJS.ProcessEnv;

	beforeEach(() => {
		directory = mkdtempSync(join(tmpdir(), 'orchard-startup-'));
		// Copy outside the installation: no node_modules (including dotenv) is available.
		copyFileSync(resolve('scripts/generate-runtime-config.mjs'), join(directory, 'generate.mjs'));
		env = {PATH: process.env.PATH, NODE_ENV: 'production'};
	});

	afterEach(() => rmSync(directory, {recursive: true, force: true}));

	it.each([undefined, 'custom data/nested'])('creates config and tmp with DATABASE_DIR=%s without .env', (data_dir) => {
		if (data_dir) env.DATABASE_DIR = data_dir;
		const result = spawnSync(process.execPath, ['generate.mjs'], {cwd: directory, env});
		expect(result.stderr.toString()).toBe('');
		expect(result.status).toBe(0);
		expect(existsSync(join(directory, data_dir || 'data', 'tmp'))).toBe(true);
		expect(JSON.parse(readFileSync(join(directory, data_dir || 'data', 'config.json'), 'utf8')).mode.production).toBe(true);
		expect(existsSync(join(directory, 'dist'))).toBe(false);
	});

	it('loads .env while preserving environment precedence', () => {
		writeFileSync(join(directory, '.env'), 'DATABASE_DIR=from-env\nBASE_PATH=from-file\nMINT_TYPE=nutshell\n');
		env.BASE_PATH = 'from-process';
		const result = spawnSync(process.execPath, ['generate.mjs'], {cwd: directory, env});
		expect(result.status).toBe(0);
		const config = JSON.parse(readFileSync(join(directory, 'from-env/config.json'), 'utf8'));
		expect(config.api.path).toBe('from-process');
		expect(config.mint.type).toBe('nutshell');
	});

	it('propagates .env errors other than ENOENT', () => {
		mkdirSync(join(directory, '.env'));
		const result = spawnSync(process.execPath, ['generate.mjs'], {cwd: directory, env});
		expect(result.status).not.toBe(0);
		expect(result.stderr.toString()).toContain('.env');
		expect(existsSync(join(directory, 'data'))).toBe(false);
	});

	it('keeps development configuration in public', () => {
		mkdirSync(join(directory, 'public'));
		env.NODE_ENV = 'development';
		const result = spawnSync(process.execPath, ['generate.mjs'], {cwd: directory, env});
		expect(result.status).toBe(0);
		expect(JSON.parse(readFileSync(join(directory, 'public/config.json'), 'utf8')).mode.production).toBe(false);
		expect(existsSync(join(directory, 'data'))).toBe(false);
	});
});
