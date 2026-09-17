/* Core Dependencies */
import {describe, expect, it} from '@jest/globals';

/* Native Dependencies */
import {extractRequestString} from './cashumintdb.helpers.js';

describe('extractRequestString', () => {
	const address = 'bcrt1qk6j0nzv6p2dy84ff6h0ukwv0309xct2huplpu5';

	it.each([JSON.stringify({Onchain: {address}}), JSON.stringify({onchain: {address}})])(
		'extracts the destination address from an onchain request: %s',
		(request: string) => {
			expect(extractRequestString(request)).toBe(address);
		},
	);

	it.each([
		{request: {offer: 'lno1offer'}, expected: 'lno1offer'},
		{request: {Bolt12: {offer: 'lno1offer'}}, expected: 'lno1offer'},
		{request: {bolt12: {offer: 'lno1offer'}}, expected: 'lno1offer'},
		{request: {bolt11: 'lnbc1invoice'}, expected: 'lnbc1invoice'},
		{request: {Bolt11: 'lnbc1invoice'}, expected: 'lnbc1invoice'},
		{request: {Bolt11: {bolt11: 'lnbc1invoice'}}, expected: 'lnbc1invoice'},
		{request: {invoice: 'lnbc1invoice'}, expected: 'lnbc1invoice'},
		{request: {offer: 'lno1offer', invoice: 'lnbc1invoice'}, expected: 'lno1offer'},
	])('preserves Lightning request extraction: $request', ({request, expected}) => {
		expect(extractRequestString(JSON.stringify(request))).toBe(expected);
	});

	it.each([address, 'lnbc1invoice', 'lno1offer', 'custom-payment-request'])('preserves bare requests: %s', (request: string) => {
		expect(extractRequestString(`  ${request}  `)).toBe(request);
	});

	it.each([
		'{invalid json',
		JSON.stringify({Onchain: null}),
		JSON.stringify({Onchain: {}}),
		JSON.stringify({Onchain: {address: ''}}),
		JSON.stringify({Onchain: {address: 123}}),
		JSON.stringify({Onchain: {address: {value: address}}}),
		JSON.stringify({Custom: {address}}),
	])('preserves unrecognized or malformed requests: %s', (request: string) => {
		expect(extractRequestString(`  ${request}  `)).toBe(request);
	});

	it.each([undefined, null, ''])('returns null for a missing request: %s', (request) => {
		expect(extractRequestString(request)).toBeNull();
	});
});
