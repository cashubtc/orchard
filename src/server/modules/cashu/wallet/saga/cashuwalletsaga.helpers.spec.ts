/* Core Dependencies */
import {expect} from '@jest/globals';
/* Vendor Dependencies */
import {HttpResponseError, MintOperationError, NetworkError, RateLimitError, StaleKeysetError} from '@cashu/cashu-ts';
/* Local Dependencies */
import {classifyMintError} from './cashuwalletsaga.helpers.js';
import {MintAddressError} from '../cashuwallet.helpers.js';
import {CashuMintErrorCode, WalletErrorAction} from '../cashuwallet.enums.js';

describe('classifyMintError', () => {
	it.each([
		[CashuMintErrorCode.OUTPUTS_ALREADY_SIGNED, WalletErrorAction.RESTORE],
		[CashuMintErrorCode.QUOTE_ALREADY_ISSUED, WalletErrorAction.RESTORE],
		[CashuMintErrorCode.PROOFS_ALREADY_SPENT, WalletErrorAction.CHECK_STATE],
		[CashuMintErrorCode.PROOFS_PENDING, WalletErrorAction.WAIT],
		[CashuMintErrorCode.OUTPUTS_PENDING, WalletErrorAction.WAIT],
		[CashuMintErrorCode.QUOTE_PENDING, WalletErrorAction.WAIT],
		[CashuMintErrorCode.QUOTE_NOT_PAID, WalletErrorAction.WAIT],
		[CashuMintErrorCode.KEYSET_INACTIVE, WalletErrorAction.REBUILD],
		[CashuMintErrorCode.TRANSACTION_NOT_BALANCED, WalletErrorAction.FAIL],
		[CashuMintErrorCode.MINTING_DISABLED, WalletErrorAction.FAIL],
		[CashuMintErrorCode.BLIND_AUTH_REQUIRED, WalletErrorAction.FAIL],
		[99999, WalletErrorAction.FAIL],
	])('maps NUT code %i to %s', (code, action) => {
		expect(classifyMintError(new MintOperationError(code, 'detail'))).toBe(action);
	});

	it('rebuilds on a cashu-ts stale keyset', () => {
		expect(classifyMintError(new StaleKeysetError(true))).toBe(WalletErrorAction.REBUILD);
	});

	it('waits when the outcome is unknown', () => {
		expect(classifyMintError(new NetworkError('socket hang up'))).toBe(WalletErrorAction.WAIT);
		expect(classifyMintError(new RateLimitError('429 Too Many Requests', 5000))).toBe(WalletErrorAction.WAIT);
		expect(classifyMintError(new HttpResponseError('bad gateway', 502))).toBe(WalletErrorAction.WAIT);
		expect(classifyMintError(new Error('unexpected'))).toBe(WalletErrorAction.WAIT);
	});

	it('fails when the guarded transport refuses the address', () => {
		expect(classifyMintError(new MintAddressError('resolves to a private address'))).toBe(WalletErrorAction.FAIL);
	});

	it('fails on other client errors', () => {
		expect(classifyMintError(new HttpResponseError('not found', 404))).toBe(WalletErrorAction.FAIL);
	});
});
