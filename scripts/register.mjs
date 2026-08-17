/**
 * Script runner hook: swc-node transpilation for the TypeScript CLI scripts.
 *
 * The env var has to be set before the transpiler hook loads, since it reads the tsconfig
 * path at module scope — hence the dynamic import, which a static one would hoist above.
 *
 * Migration-scoped — delete once the scripts no longer need a TypeScript loader.
 */
import {join} from 'node:path';

process.env.SWC_NODE_PROJECT ??= join(import.meta.dirname, '..', 'tsconfig.server.json');

// Without the `orchard-src` condition the `#server/*` imports map falls through to its `dist`
// branch, so a script meant to run the working tree silently executes the last build instead.
// The condition has to be a process flag rather than something set here: the transpiler caches
// its condition set on the first resolution, which precedes any hook this module could register.
const entry = import.meta.resolve('#server/main');
if (!entry.endsWith('.ts')) throw new Error(`#server/main resolved to ${entry}; add --conditions=orchard-src before --import.`);

await import('@swc-node/register/esm-register');
