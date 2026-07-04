/**
 * Public API for backend source-of-truth readers. Specs and setup phases
 * import from `helpers/backend` (this index) and pick which domain they need:
 *   import {ln, mint, orchard} from '@e2e/helpers/backend';
 *
 * Internal infrastructure (`docker-cli`, `regtest`, `_cache`, `_sql`) is not
 * re-exported here — import from the specific submodule when needed.
 */

export {btc} from './btc';
export {ln} from './lightning';
export {mint} from './mint';
export {orchard} from './orchard';
export {tap} from './tapd';
export {ollamaIdle, waitForOllamaIdle} from './ai';
