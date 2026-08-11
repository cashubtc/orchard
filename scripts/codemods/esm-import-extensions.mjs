/**
 * Appends explicit `.js` extensions to relative import specifiers, as required by
 * nodenext module resolution. Idempotent — safe to re-run.
 *
 * Bare specifiers are left alone, `#server/*` included — the imports map supplies their
 * extension, so suffixing one stops it resolving.
 *
 * Migration-scoped — run in the order listed in the README; delete once every
 * pre-ESM branch has merged or rebased.
 *
 * Usage: node scripts/codemods/esm-import-extensions.mjs [--dry]
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname, resolve } from 'path';
import ts from 'typescript';

const ROOTS = ['src/server', 'scripts'];

const dry_run = process.argv.includes('--dry');
const warnings = [];

/** Lists every .ts file under a root directory. */
function collectFiles(root) {
    if (!existsSync(root)) return [];
    return readdirSync(root, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts'))
        .map((entry) => join(entry.parentPath, entry.name));
}

/** Returns the extension to append to a specifier, or null when it already resolves. */
function suffixFor(specifier, file) {
    if (!ts.isExternalModuleNameRelative(specifier) || specifier.endsWith('.js')) return null;
    const base = resolve(dirname(file), specifier);
    if (existsSync(`${base}.ts`)) return '.js';
    if (existsSync(join(base, 'index.ts'))) return '/index.js';
    warnings.push(`${specifier} (in ${file})`);
    return null;
}

/** Collects the offset of each rewritable specifier's closing quote. */
function editsFor(source_file, file) {
    const edits = [];
    const record = (specifier) => {
        if (!specifier || !ts.isStringLiteral(specifier)) return;
        const suffix = suffixFor(specifier.text, file);
        if (suffix) edits.push({ at: specifier.end - 1, suffix });
    };
    const visit = (node) => {
        if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) record(node.moduleSpecifier);
        if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) record(node.arguments[0]);
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
    for (const edit of edits.sort((a, b) => b.at - a.at)) {
        updated = updated.slice(0, edit.at) + edit.suffix + updated.slice(edit.at);
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
