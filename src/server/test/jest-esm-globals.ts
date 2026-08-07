/**
 * Exposes `jest` as a global for specs.
 *
 * Under ESM the `jest` object is no longer injected as a module-wrapper parameter, so it
 * would otherwise have to be imported into every spec that uses it. Importing it also
 * shadows the ambient `@types/jest` declarations, whose looser generics the existing mock
 * call sites are written against. Assigning it here keeps both the runtime value and the
 * ambient typing intact.
 */
import {jest} from '@jest/globals';

Object.assign(globalThis, {jest});
