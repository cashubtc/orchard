/* Core Dependencies */
import {readdirSync, readFileSync} from 'fs';
import {join, dirname} from 'path';
import {fileURLToPath} from 'url';

/**
 * Ensures every onModuleInit / onApplicationBootstrap implementation
 * contains a SCHEMA_ONLY early-return guard.
 *
 * During schema generation the app boots with SCHEMA_ONLY=true.
 * Services that run init logic (gRPC connections, backfills, etc.)
 * must check this flag and return early, otherwise the build can
 * hang or consume excessive memory on constrained hosts.
 */
const CURRENT_DIR = dirname(fileURLToPath(import.meta.url));

describe('SCHEMA_ONLY guard', () => {
	const MODULES_DIR = join(CURRENT_DIR, '..', 'modules');
	const HOOK_PATTERN = /(?:async\s+)?(?:public\s+)?(?:async\s+)?on(?:ModuleInit|ApplicationBootstrap)\s*\(/;
	const GUARD_PATTERN = /process\.env\.SCHEMA_ONLY/;

	/** Recursively collect all .ts files (excluding specs and node_modules) */
	function walk(dir: string): string[] {
		const results: string[] = [];
		for (const entry of readdirSync(dir, {withFileTypes: true})) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				results.push(...walk(full));
			} else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') && !entry.name.endsWith('.d.ts')) {
				results.push(full);
			}
		}
		return results;
	}

	it('all lifecycle init hooks must guard against SCHEMA_ONLY', () => {
		const files = walk(MODULES_DIR);
		const missing: string[] = [];

		for (const file of files) {
			const content = readFileSync(file, 'utf-8');
			if (HOOK_PATTERN.test(content) && !GUARD_PATTERN.test(content)) {
				const relative = file.replace(join(CURRENT_DIR, '..', '..', '..') + '/', '');
				missing.push(relative);
			}
		}

		if (missing.length > 0) {
			throw new Error(
				`The following files implement onModuleInit or onApplicationBootstrap without a SCHEMA_ONLY guard:\n\n` +
					missing.map((f) => `  - ${f}`).join('\n') +
					`\n\nAdd \`if (process.env.SCHEMA_ONLY) return;\` as the first line of the hook.`,
			);
		}
	});
});
