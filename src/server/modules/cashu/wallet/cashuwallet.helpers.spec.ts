/* Core Dependencies */
import {expect} from '@jest/globals';
/* Vendor Dependencies */
import {HttpResponseError, MintOperationError, NetworkError, RateLimitError, StaleKeysetError} from '@cashu/cashu-ts';
/* Local Dependencies */
import {MintAddressError, classifyMintError, describeMintError} from './cashuwallet.helpers.js';
import {CashuMintErrorCode, WalletErrorAction} from './cashuwallet.enums.js';

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

describe('describeMintError', () => {
	it('names the NUT code and detail', () => {
		expect(describeMintError(new MintOperationError(11001, 'Token already spent'))).toBe('Mint error 11001: Token already spent');
	});

	it("keeps the mint's code when cashu-ts wraps a keyset rejection", () => {
		const error = new StaleKeysetError(true, {cause: new MintOperationError(12002, 'Keyset inactive')});
		expect(describeMintError(error)).toBe('Mint error 12002: Keyset inactive');
	});

	it('explains auth-protected mints', () => {
		expect(describeMintError(new MintOperationError(31001, 'Endpoint requires blind auth'))).toContain('requires authentication');
	});

	it('includes the HTTP status for non-protocol errors', () => {
		expect(describeMintError(new HttpResponseError('not found', 404))).toBe('not found (HTTP 404)');
	});
});
