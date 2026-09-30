/* Core Dependencies */
import {expect} from '@jest/globals';
/* Vendor Dependencies */
import {
	Amount,
	HttpResponseError,
	MintOperationError,
	MintQuoteState,
	NetworkError,
	RateLimitError,
	StaleKeysetError,
	getPubKeyFromPrivKey,
	mnemonicToSeedSync,
} from '@cashu/cashu-ts';
/* Local Dependencies */
import {MintAddressError, assessMintQuote, classifyMintError, deriveQuoteKey, describeMintError} from './cashuwallet.helpers.js';
import {CashuMintErrorCode, MintQuoteProgress, WalletErrorAction} from './cashuwallet.enums.js';

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

describe('assessMintQuote', () => {
	const base = {quote: 'q', request: 'r', unit: 'sat'};
	const totals = (paid: number, issued: number, expiry: number | null = null) => ({
		...base,
		amount_paid: Amount.from(paid),
		amount_issued: Amount.from(issued),
		expiry,
	});

	it.each([
		['bolt11 paid', {...base, state: MintQuoteState.PAID, expiry: 10}, MintQuoteProgress.MINTABLE],
		['bolt11 issued', {...base, state: MintQuoteState.ISSUED, expiry: 10}, MintQuoteProgress.ISSUED],
		['bolt11 unpaid', {...base, state: MintQuoteState.UNPAID, expiry: 200}, MintQuoteProgress.WAITING],
		['bolt11 unpaid and expired', {...base, state: MintQuoteState.UNPAID, expiry: 50}, MintQuoteProgress.EXPIRED],
		['bolt12 paid enough', totals(150, 50, 50), MintQuoteProgress.MINTABLE],
		['bolt12 partly paid, even when expired', totals(40, 0, 50), MintQuoteProgress.WAITING],
		['onchain fully issued', totals(100, 100), MintQuoteProgress.ISSUED],
		['bolt12 unpaid and expired', totals(0, 0, 50), MintQuoteProgress.EXPIRED],
		['unpaid with no expiry', totals(0, 0), MintQuoteProgress.WAITING],
	])('%s', (_label, quote, progress) => {
		expect(assessMintQuote(quote, 100, 100)).toBe(progress);
	});
});

describe('deriveQuoteKey', () => {
	const seed = mnemonicToSeedSync('half depart obvious quality work element tank gorilla view sugar picture humble');

	it.each([
		[0, '03062837166e56114b59a4d1fd3a5a812bf7aadc1dde758428cf943d80acd41539'],
		[1, '02b47d9d41725f5ce6f08c874835cef25376cb1e95f6cb073fef52ca8fd986cf15'],
		[2, '029acbd3a46fd75bc05ba0226d0b4d909b2fb6e96c80544a094a1a3567737e44d3'],
		[3, '0373e4a42fbe0a4e18aadb57cf500b655f2446b4071ee579121d2ed8905bcc49c2'],
		[4, '02b8709bfce17c10f1864f5218844533ae60930d52089669b317d8b5f474eec071'],
	])('matches the NUT-20 test vector at counter %i', (counter, pubkey) => {
		const key = deriveQuoteKey(seed, counter);
		expect(key.pubkey).toBe(pubkey);
		expect(Buffer.from(getPubKeyFromPrivKey(Buffer.from(key.privkey, 'hex'))).toString('hex')).toBe(pubkey);
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

	it('reads mint RPC errors in their Orchard shapes', () => {
		expect(describeMintError({code: 40007, details: 'Mint quote state override is disabled'})).toBe(
			'Mint quote state override is disabled',
		);
		expect(describeMintError(40005)).toBe('MintRpcConnectionError');
	});
});
