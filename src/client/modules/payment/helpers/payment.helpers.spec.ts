/* Local Dependencies */
import {parsePayment} from './payment.helpers';

/* Valid strings from the BOLT 11, BOLT 12, BIP173, LUD-01 and NUT-00 vectors */
const INVOICE =
	'lnbc25m1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5vdhkven9v5sxyetpdeessp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygs9q5sqqqqqqqqqqqqqqqqsgq2a25dxl5hrntdtn6zvydt7d66hyzsyhqs4wdynavys42xgl6sgx9c4g7me86a27t07mdtfry458rtjr0v92cnmswpsjscgt2vcse3sgpz3uapa';
const OFFER = 'lno1zcss9mk8y3wkklfvevcrszlmu23kfrxh49px20665dqwmn4p72pksese';
const ADDRESS = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
const LNURL =
	'LNURL1DP68GURN8GHJ7UM9WFMXJCM99E3K7MF0V9CXJ0M385EKVCENXC6R2C35XVUKXEFCV5MKVV34X5EKZD3EV56NYD3HXQURZEPEXEJXXEPNXSCRVWFNV9NXZCN9XQ6XYEFHVGCXXCMYXYMNSERXFQ5FNS';
const TOKEN =
	'cashuBo2F0gqJhaUgA_9SLj17PgGFwgaNhYQFhc3hAYWNjMTI0MzVlN2I4NDg0YzNjZjE4NTAxNDkyMThhZjkwZjcxNmE1MmJmNGE1ZWQzNDdlNDhlY2MxM2Y3NzM4OGFjWCECRFODGd5IXVW-07KaZCvuWHk3WrnnpiDhHki6SCQh88-iYWlIAK0mjE0fWCZhcIKjYWECYXN4QDEzMjNkM2Q0NzA3YTU4YWQyZTIzYWRhNGU5ZjFmNDlmNWE1YjRhYzdiNzA4ZWIwZDYxZjczOGY0ODMwN2U4ZWVhY1ghAjRWqhENhLSsdHrr2Cw7AFrKUL9Ffr1XN6RBT6w659lNo2FhAWFzeEA1NmJjYmNiYjdjYzY0MDZiM2ZhNWQ1N2QyMTc0ZjRlZmY4YjQ0MDJiMTc2OTI2ZDNhNTdkM2MzZGNiYjU5ZDU3YWNYIQJzEpxXGeWZN5qXSmJjY8MzxWyvwObQGr5G1YCCgHicY2FtdWh0dHA6Ly9sb2NhbGhvc3Q6MzMzOGF1Y3NhdA';

/** The kinds a string reads as, best first */
function kindsOf(input: string): string[] {
	return parsePayment(input).map((option) => option.kind);
}

describe('PaymentHelpers', () => {
	describe('parsePayment', () => {
		it('reads a bare invoice, offer or address', () => {
			expect(kindsOf(INVOICE)).toEqual(['bolt11']);
			expect(kindsOf(OFFER)).toEqual(['bolt12']);
			expect(kindsOf(ADDRESS)).toEqual(['onchain']);
		});

		it('takes a lightning: prefix in any case, trimming what was pasted', () => {
			expect(parsePayment(`  LIGHTNING:${INVOICE.toUpperCase()}\n`)).toEqual([
				jasmine.objectContaining({kind: 'bolt11', request: INVOICE}),
			]);
		});

		it('ranks what a BIP321 URI carries: offer, invoice, then address', () => {
			expect(kindsOf(`bitcoin:${ADDRESS}?lightning=${INVOICE}&lno=${OFFER}`)).toEqual(['bolt12', 'bolt11', 'onchain']);
		});

		it('follows the lightning parameter of a web link, and reads nothing from a link without one', () => {
			expect(parsePayment(`https://service.com/giftcard/redeem?id=123&lightning=${LNURL}`)).toEqual([
				{kind: 'lnurl', request: LNURL},
			]);
			expect(parsePayment('https://example.com/pay/8f2c')).toEqual([]);
		});

		it('reads nothing from an ecash token, which is not a payment instruction', () => {
			expect(parsePayment(TOKEN)).toEqual([]);
			expect(parsePayment(`cashu:${TOKEN}`)).toEqual([]);
		});

		it('reads nothing from what is none of these', () => {
			expect(parsePayment('')).toEqual([]);
			expect(parsePayment('hello')).toEqual([]);
		});
	});
});
