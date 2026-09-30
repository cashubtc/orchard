/* Core Dependencies */
import {expect} from '@jest/globals';
/* Vendor Dependencies */
import {HttpResponseError, MintOperationError, NetworkError, StaleKeysetError} from '@cashu/cashu-ts';
import {status} from '@grpc/grpc-js';
/* Application Dependencies */
import {OrchardErrorCode} from '#server/modules/error/error.types';
/* Local Dependencies */
import {classifyMintError, classifyMintRpcError} from './cashuwalletsaga.helpers.js';
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
