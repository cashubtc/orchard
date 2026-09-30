/* Core Dependencies */
import {expect} from '@jest/globals';
/* Vendor Dependencies */
import {HttpResponseError, MintOperationError, StaleKeysetError} from '@cashu/cashu-ts';
/* Local Dependencies */
import {describeMintError} from './cashuwallet.helpers.js';

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
