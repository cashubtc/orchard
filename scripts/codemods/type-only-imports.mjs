/**
 * Marks imports of type-only exports with the `type` modifier. Idempotent — safe to re-run.
 *
 * swc compiles each file alone, so it cannot tell a type import from a value one. With
 * decorator metadata enabled it keeps the binding to reference in `design:paramtypes`, and
 * under ESM that binding fails to link because the target exports nothing at runtime. The
 * modifier is the signal that lets it strip the import instead.
 *
 * Only names declared as `export type` or `export interface` are touched — they have no
 * runtime value, so nothing can be lost. Exported classes and enums are left alone: those
 * do carry usable metadata, and marking them would break it.
 *
 * Migration-scoped — delete once the server runs as ESM.
 *
 * Usage: node scripts/codemods/type-only-imports.mjs [--dry]
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import ts from 'typescript';

const ROOTS = ['src/server'];

const dry_run = process.argv.includes('--dry');

/** Lists every .ts file under a root directory. */
function collectFiles(root) {
    if (!existsSync(root)) return [];
    return readdirSync(root, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts'))
        .map((entry) => join(entry.parentPath, entry.name));
}

const files = ROOTS.flatMap(collectFiles);
const parse = (file) => ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest);

/** Names each file exports as a type alias or interface, keyed by absolute path. */
const type_exports = new Map(
    files.map((file) => {
        const names = new Set();
        parse(file).forEachChild((node) => {
            if (!ts.isTypeAliasDeclaration(node) && !ts.isInterfaceDeclaration(node)) return;
            if (node.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) names.add(node.name.text);
        });
        return [resolve(file), names];
    }),
);

/** Resolves a `#server/*` or relative specifier to the file it names. */
function targetOf(specifier, file) {
    let base;
    if (specifier.startsWith('#server/')) base = resolve('src/server', specifier.slice('#server/'.length));
    else if (ts.isExternalModuleNameRelative(specifier)) base = resolve(dirname(file), specifier.replace(/\.js$/, ''));
    else return null;
    if (existsSync(`${base}.ts`)) return resolve(`${base}.ts`);
    if (existsSync(join(base, 'index.ts'))) return resolve(join(base, 'index.ts'));
    return null;
}

/** Collects the offsets where a `type` modifier belongs. */
function editsFor(source_file, file) {
    const edits = [];
    source_file.forEachChild((node) => {
        const clause = ts.isImportDeclaration(node) ? node.importClause : null;
        if (!clause || clause.isTypeOnly || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings)) return;

        const names = type_exports.get(targetOf(node.moduleSpecifier.text, file));
        if (!names) return;
        const specifiers = clause.namedBindings.elements;
        const type_only = specifiers.filter((specifier) => !specifier.isTypeOnly && names.has((specifier.propertyName ?? specifier.name).text));
        if (type_only.length === 0) return;

        // A default import cannot be combined with a type-only clause, so fall back to per-specifier.
        if (type_only.length === specifiers.length && !clause.name) {
            edits.push({ at: node.getStart(source_file) + 'import'.length, text: ' type' });
            return;
        }
        type_only.forEach((specifier) => edits.push({ at: specifier.getStart(source_file), text: 'type ' }));
    });
    return edits;
}

let total_sites = 0;
let total_files = 0;

for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const edits = editsFor(parse(file), file);
    if (edits.length === 0) continue;

    // Apply bottom-up so earlier offsets stay valid.
    let updated = text;
    for (const edit of edits.sort((a, b) => b.at - a.at)) {
        updated = updated.slice(0, edit.at) + edit.text + updated.slice(edit.at);
    }

    if (!dry_run) writeFileSync(file, updated);
    total_sites += edits.length;
    total_files += 1;
    console.log(`  ${edits.length.toString().padStart(3)}  ${file}`);
}

console.log(`\n${dry_run ? '[dry run] ' : ''}${total_sites} imports marked across ${total_files} files`);
