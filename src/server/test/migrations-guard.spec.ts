/* Core Dependencies */
import {readdirSync, readFileSync} from 'fs';
import {join, dirname} from 'path';
import {fileURLToPath} from 'url';

/**
 * Ensures the migrations barrel and the migrations directory agree, in both directions.
 *
 * The barrel is the only registry — both the CLI data source and the running app build
 * their migration list from it. An unlisted file is silently skipped everywhere, so the
 * schema drifts with nothing to report it; a listed file that no longer exists is dead
 * weight that survives every runtime check, because re-exporting nothing still works.
 */
const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));

describe('migrations barrel', () => {
	const MIGRATIONS_DIR = join(CURRENT_DIR, '..', 'database', 'migrations');

	const barrel = () => readFileSync(join(MIGRATIONS_DIR, 'index.ts'), 'utf-8');
	const migrationFiles = () => readdirSync(MIGRATIONS_DIR).filter((name) => name.endsWith('.ts') && name !== 'index.ts');
	const exported = () => [...barrel().matchAll(/export \* from '\.\/(.+)\.js';/g)].map((match) => `${match[1]}.ts`);

	it('every migration file must be exported from index.ts', () => {
		const exports = exported();
		const missing = migrationFiles().filter((name) => !exports.includes(name));

		if (missing.length > 0) {
			throw new Error(
				`The following migrations are not exported from src/server/database/migrations/index.ts:\n\n` +
					missing.map((name) => `  - ${name}`).join('\n') +
					`\n\nAdd \`export * from './<filename>.js';\` for each. Unexported migrations never run.`,
			);
		}
	});

	it('every export in index.ts must name a migration file', () => {
		const files = migrationFiles();
		const stray = exported().filter((name) => !files.includes(name));

		if (stray.length > 0) {
			throw new Error(
				`src/server/database/migrations/index.ts exports paths with no migration behind them:\n\n` +
					stray.map((name) => `  - ${name}`).join('\n') +
					`\n\nRemove them, or restore the migration files they name.`,
			);
		}
	});
});
