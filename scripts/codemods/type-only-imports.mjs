/**
 * Marks imports of type-only bindings with the `type` modifier. Idempotent — safe to re-run.
 *
 * swc compiles each file alone, so it cannot tell a type import from a value one. With
 * decorator metadata enabled it keeps the binding to reference in `design:paramtypes`, and
 * under ESM that binding fails to link because the target exports nothing at runtime. The
 * modifier is the signal that lets it strip the import instead.
 *
 * Type-ness comes from the TypeScript checker rather than a file scan, so bindings from
 * node_modules are covered too — those are the ones a hand-written resolver cannot see, and
 * the ones `verbatimModuleSyntax` reports as TS1484.
 *
 * Migration-scoped — delete once the server runs as ESM.
 *
 * Usage: node scripts/codemods/type-only-imports.mjs [--dry]
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import ts from 'typescript';

const ROOT = 'src/server';
const TSCONFIG = 'tsconfig.server.json';

const dry_run = process.argv.includes('--dry');

/** Lists every .ts file under a root directory. */
function collectFiles(root) {
    if (!existsSync(root)) return [];
    return readdirSync(root, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
        .map((entry) => join(entry.parentPath, entry.name));
}

// Specs are excluded from the build config but still need marking, so the program is built
// from every file rather than the config's own file list.
const config = ts.readConfigFile(TSCONFIG, ts.sys.readFile).config;
const { options } = ts.parseJsonConfigFileContent(config, ts.sys, '.');
const files = collectFiles(ROOT);
const program = ts.createProgram(files, options);
const checker = program.getTypeChecker();

/** True when a named import resolves to something with no runtime value behind it. */
function isTypeOnly(specifier) {
    const symbol = checker.getSymbolAtLocation(specifier.name);
    if (!symbol) return false;
    const target = symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol;
    if (target.flags & ts.SymbolFlags.Value) return false;
    return Boolean(target.flags & (ts.SymbolFlags.Type | ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Interface));
}

/** Collects the offsets where a `type` modifier belongs. */
function editsFor(source_file) {
    const edits = [];
    source_file.forEachChild((node) => {
        const clause = ts.isImportDeclaration(node) ? node.importClause : null;
        if (!clause || clause.isTypeOnly || !clause.namedBindings || !ts.isNamedImports(clause.namedBindings)) return;

        const specifiers = clause.namedBindings.elements;
        const type_only = specifiers.filter((specifier) => !specifier.isTypeOnly && isTypeOnly(specifier));
        if (type_only.length === 0) return;

        // Prefer the whole-clause form: `import {type A}` alone would leave `import {}`, a
        // side-effect import that survives compilation. A default import cannot combine with
        // it, so those fall back to per-specifier.
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
    const source_file = program.getSourceFile(file);
    if (!source_file) continue;

    const edits = editsFor(source_file);
    if (edits.length === 0) continue;

    // Apply bottom-up so earlier offsets stay valid.
    let updated = readFileSync(file, 'utf8');
    for (const edit of edits.sort((a, b) => b.at - a.at)) {
        updated = updated.slice(0, edit.at) + edit.text + updated.slice(edit.at);
    }

    if (!dry_run) writeFileSync(file, updated);
    total_sites += edits.length;
    total_files += 1;
    console.log(`  ${edits.length.toString().padStart(3)}  ${file}`);
}

console.log(`\n${dry_run ? '[dry run] ' : ''}${total_sites} imports marked across ${total_files} files`);
