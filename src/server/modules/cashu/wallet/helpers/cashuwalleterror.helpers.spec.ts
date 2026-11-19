/* Core Dependencies */
import {expect} from '@jest/globals';
/* Vendor Dependencies */
import {HttpResponseError, MintOperationError, NetworkError, StaleKeysetError} from '@cashu/cashu-ts';
import {status} from '@grpc/grpc-js';
/* Application Dependencies */
import {OrchardErrorCode} from '#server/modules/error/error.types';
/* Native Dependencies */
import {CashuMintErrorCode, WalletErrorAction} from '#server/modules/cashu/wallet/cashuwallet.enums';
/* Local Dependencies */
import {classifyMintError, classifyMintRpcError, describeMintError} from './cashuwalleterror.helpers.js';

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

	it('reads mint RPC errors in their Orchard shapes', () => {
		expect(describeMintError({code: 40007, details: 'Mint quote state override is disabled'})).toBe(
			'Mint quote state override is disabled',
		);
		expect(describeMintError(40005)).toBe('MintRpcConnectionError');
	});
});

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
		[CashuMintErrorCode.MAX_INPUTS_EXCEEDED, WalletErrorAction.FAIL],
		[CashuMintErrorCode.INVOICE_ALREADY_PAID, WalletErrorAction.FAIL],
		[10002, WalletErrorAction.RESTORE],
		[10003, WalletErrorAction.FAIL],
		[50000, WalletErrorAction.CHECK_STATE],
		[99999, WalletErrorAction.CHECK_STATE],
	])('maps NUT code %i to %s', (code, action) => {
		expect(classifyMintError(new MintOperationError(code, 'detail'))).toBe(action);
	});

	it('reads 11002 from a mint on the old numbering, where it meant not balanced', () => {
		expect(classifyMintError(new MintOperationError(11002, 'Proofs are pending'))).toBe(WalletErrorAction.WAIT);
		expect(classifyMintError(new MintOperationError(11002, 'Transaction is not balanced (inputs != outputs)'))).toBe(
			WalletErrorAction.FAIL,
		);
	});

	it('rebuilds on a cashu-ts stale keyset', () => {
		expect(classifyMintError(new StaleKeysetError(true))).toBe(WalletErrorAction.REBUILD);
	});

	it.each([
		['a network failure', new NetworkError('socket hang up')],
		['an HTTP error without a NUT code', new HttpResponseError('request timeout', 408)],
		['an unexpected error', new Error('unexpected')],
	])('waits on %s, which never proves the mint refused', (_label, error) => {
		expect(classifyMintError(error)).toBe(WalletErrorAction.WAIT);
	});
});

describe('classifyMintRpcError', () => {
	it.each([
		['the RPC client failing before sending', OrchardErrorCode.MintRpcConnectionError, WalletErrorAction.FAIL],
		[
			'an invalid argument',
			{code: OrchardErrorCode.MintRpcInvalidArgumentError, details: 'Could not find quote'},
			WalletErrorAction.FAIL,
		],
		['a disabled override', Object.assign(new Error('override is disabled'), {code: status.PERMISSION_DENIED}), WalletErrorAction.FAIL],
		['a dropped connection', {code: OrchardErrorCode.MintRpcConnectionError, details: 'Connection dropped'}, WalletErrorAction.WAIT],
		['a deadline', Object.assign(new Error('deadline exceeded'), {code: status.DEADLINE_EXCEEDED}), WalletErrorAction.WAIT],
		['an unexpected error', new Error('boom'), WalletErrorAction.WAIT],
	])('%s: %s', (_label, error, action) => {
		expect(classifyMintRpcError(error)).toBe(action);
	});
});
