/**
 * Rewrites `@server/*` tsconfig-path specifiers to `#server/*` Node subpath imports.
 * Idempotent — safe to re-run.
 *
 * Subpath imports resolve natively in both CJS and ESM, so no build-time rewriting is
 * involved and the emitted specifier is the authored one. The mapping supplies the file
 * extension, so these stay extensionless — except directory targets, which must name
 * their `index` explicitly because the mapping is a literal substitution.
 *
 * Migration-scoped — delete once the server runs as ESM.
 *
 * Usage: node scripts/codemods/relativize-server-alias.mjs [--dry]
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import ts from 'typescript';

const ROOTS = ['src/server'];
const OLD_PREFIX = '@server/';
const NEW_PREFIX = '#server/';

const dry_run = process.argv.includes('--dry');
const warnings = [];

/** Lists every .ts file under a root directory. */
function collectFiles(root) {
    if (!existsSync(root)) return [];
    return readdirSync(root, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts'))
        .map((entry) => join(entry.parentPath, entry.name));
}

/** Returns the replacement specifier, or null when this literal is not a rewritable alias. */
function replacementFor(specifier, file) {
    if (!specifier.startsWith(OLD_PREFIX)) return null;
    const rest = specifier.slice(OLD_PREFIX.length);
    const base = resolve('src/server', rest);
    if (existsSync(`${base}.ts`)) return `${NEW_PREFIX}${rest}`;
    if (existsSync(join(base, 'index.ts'))) return `${NEW_PREFIX}${rest}/index`;
    warnings.push(`${specifier} (in ${file})`);
    return null;
}

/**
 * Collects the span of each rewritable specifier's text.
 *
 * Every `@server/` string literal in these files is a module specifier, so matching on the
 * literal rather than the import node also covers the jest.unstable_mockModule and dynamic
 * import() call sites without special-casing them.
 */
function editsFor(source_file, file) {
    const edits = [];
    const visit = (node) => {
        if (ts.isStringLiteral(node)) {
            const replacement = replacementFor(node.text, file);
            // Span excludes the quotes, so the original quote style survives.
            if (replacement) edits.push({ start: node.getStart(source_file) + 1, end: node.end - 1, replacement });
        }
        ts.forEachChild(node, visit);
    };
    visit(source_file);
    return edits;
}

let total_sites = 0;
let total_files = 0;

for (const file of ROOTS.flatMap(collectFiles)) {
    const text = readFileSync(file, 'utf8');
    const edits = editsFor(ts.createSourceFile(file, text, ts.ScriptTarget.Latest), file);
    if (edits.length === 0) continue;

    // Apply bottom-up so earlier offsets stay valid.
    let updated = text;
    for (const edit of edits.sort((a, b) => b.start - a.start)) {
        updated = updated.slice(0, edit.start) + edit.replacement + updated.slice(edit.end);
    }

    if (!dry_run) writeFileSync(file, updated);
    total_sites += edits.length;
    total_files += 1;
    console.log(`  ${edits.length.toString().padStart(3)}  ${file}`);
}

console.log(`\n${dry_run ? '[dry run] ' : ''}${total_sites} specifiers rewritten across ${total_files} files`);
if (warnings.length > 0) {
    console.log(`\n${warnings.length} unresolved specifiers left untouched:`);
    warnings.forEach((warning) => console.log(`  ! ${warning}`));
}
