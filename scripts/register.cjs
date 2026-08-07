/**
 * Script runner hook: swc-node transpilation plus `.js` -> `.ts` resolution.
 *
 * Source imports carry explicit `.js` extensions for nodenext, but on disk the files
 * are `.ts`. Node's CJS resolver never substitutes extensions for a specifier that
 * already has one, so retry those as `.ts`.
 *
 * Migration-scoped — delete once package.json sets `"type": "module"`, where
 * `@swc-node/register/esm-register` resolves these natively.
 */
const Module = require('module');
const {join} = require('path');

process.env.SWC_NODE_PROJECT ??= join(__dirname, '..', 'tsconfig.server.json');

require('@swc-node/register');

const resolveFilename = Module._resolveFilename;

/** Only our own relative imports carry `.js` for files that are `.ts` on disk — never node_modules. */
function isRetryable(request, error) {
    return error.code === 'MODULE_NOT_FOUND' && typeof request === 'string' && request.startsWith('.') && request.endsWith('.js');
}

Module._resolveFilename = function (request, ...rest) {
    try {
        return resolveFilename.call(this, request, ...rest);
    } catch (error) {
        if (!isRetryable(request, error)) throw error;
        try {
            return resolveFilename.call(this, `${request.slice(0, -3)}.ts`, ...rest);
        } catch {
            throw error;
        }
    }
};
