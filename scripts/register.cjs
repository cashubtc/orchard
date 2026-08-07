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

require('@swc-node/register');

const resolveFilename = Module._resolveFilename;

Module._resolveFilename = function (request, ...rest) {
    try {
        return resolveFilename.call(this, request, ...rest);
    } catch (error) {
        if (typeof request !== 'string' || !request.endsWith('.js')) throw error;
        try {
            return resolveFilename.call(this, `${request.slice(0, -3)}.ts`, ...rest);
        } catch {
            throw error;
        }
    }
};
