/* Local Dependencies */
import {readInstruction} from './instruction.helpers';

/* Valid strings from the BOLT 11, BOLT 12, BIP352, LUD-01 and NUT-26 vectors */
const INVOICE =
	'lnbc25m1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5vdhkven9v5sxyetpdeessp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygs9q5sqqqqqqqqqqqqqqqqsgq2a25dxl5hrntdtn6zvydt7d66hyzsyhqs4wdynavys42xgl6sgx9c4g7me86a27t07mdtfry458rtjr0v92cnmswpsjscgt2vcse3sgpz3uapa';
const OFFER = 'lno1zcss9mk8y3wkklfvevcrszlmu23kfrxh49px20665dqwmn4p72pksese';
const SILENT_PAYMENT =
	'sp1qqgste7k9hx0qftg6qmwlkqtwuy6cycyavzmzj85c6qdfhjdpdjtdgq7c2zfthc6x3a5yecwc52nxa0kfd20xuz08zyrjpfw4l2j257yq6qgnkdh5';
const LNURL =
	'LNURL1DP68GURN8GHJ7UM9WFMXJCM99E3K7MF0V9CXJ0M385EKVCENXC6R2C35XVUKXEFCV5MKVV34X5EKZD3EV56NYD3HXQURZEPEXEJXXEPNXSCRVWFNV9NXZCN9XQ6XYEFHVGCXXCMYXYMNSERXFQ5FNS';
const CREQ_B =
	'CREQB1QYQQWER9D4HNZV3NQGQQSQQQQQQQQQQRAQPSQQGQQSQQZQG9QQVXSAR5WPEN5TE0D45KUAPWV4UXZMTSD3JJUCM0D5RQQRJRDANXVET9YPCXZ7TDV4H8GXHR3TQ';

describe('InstructionHelpers', () => {
	describe('readInstruction', () => {
		it('decodes an invoice, offer or address, behind a lightning: prefix too', () => {
			expect(readInstruction(INVOICE)?.kind).toBe('bolt11');
			expect(readInstruction(`lightning://${OFFER}`)?.kind).toBe('bolt12');
			expect(readInstruction('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')?.kind).toBe('onchain');
		});

		it('recognizes formats it reads nothing from, keeping the string without its prefix', () => {
			expect(readInstruction(`lightning:${LNURL}`)).toEqual({kind: 'lnurl', request: LNURL});
			expect(readInstruction('lnurlp://service.com/pay')?.kind).toBe('lnurl');
			expect(readInstruction('satoshi@bitcoin.org')?.kind).toBe('lightning_address');
			expect(readInstruction('₿satoshi@bitcoin.org')?.kind).toBe('bip353');
			expect(readInstruction(CREQ_B)?.kind).toBe('payment_request');
			expect(readInstruction(OFFER.replace('lno', 'lni'))?.kind).toBe('bolt12_invoice');
			expect(readInstruction(SILENT_PAYMENT)?.kind).toBe('silent_payment');
		});

		it('is null for what is none of these', () => {
			expect(readInstruction('hello')).toBeNull();
			expect(readInstruction(`${INVOICE.slice(0, -1)}q`)).toBeNull();
		});
	});
});
