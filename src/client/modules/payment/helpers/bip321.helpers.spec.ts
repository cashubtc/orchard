/* Local Dependencies */
import {parseBip321} from './bip321.helpers';

/* Valid strings from the BOLT 11, BOLT 12, BIP173, BIP350, BIP352, LUD-01 and NUT-26 vectors */
const BASE58 = '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2';
const SEGWIT = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
const TAPROOT = 'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0';
const INVOICE =
	'lnbc25m1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5vdhkven9v5sxyetpdeessp5zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zyg3zygs9q5sqqqqqqqqqqqqqqqqsgq2a25dxl5hrntdtn6zvydt7d66hyzsyhqs4wdynavys42xgl6sgx9c4g7me86a27t07mdtfry458rtjr0v92cnmswpsjscgt2vcse3sgpz3uapa';
const OFFER = 'lno1zcss9mk8y3wkklfvevcrszlmu23kfrxh49px20665dqwmn4p72pksese';
const SILENT_PAYMENT =
	'sp1qqgste7k9hx0qftg6qmwlkqtwuy6cycyavzmzj85c6qdfhjdpdjtdgq7c2zfthc6x3a5yecwc52nxa0kfd20xuz08zyrjpfw4l2j257yq6qgnkdh5';
const LNURL =
	'LNURL1DP68GURN8GHJ7UM9WFMXJCM99E3K7MF0V9CXJ0M385EKVCENXC6R2C35XVUKXEFCV5MKVV34X5EKZD3EV56NYD3HXQURZEPEXEJXXEPNXSCRVWFNV9NXZCN9XQ6XYEFHVGCXXCMYXYMNSERXFQ5FNS';
const CREQ_B =
	'CREQB1QYQQWER9D4HNZV3NQGQQSQQQQQQQQQQRAQPSQQGQQSQQZQG9QQVXSAR5WPEN5TE0D45KUAPWV4UXZMTSD3JJUCM0D5RQQRJRDANXVET9YPCXZ7TDV4H8GXHR3TQ';

describe('Bip321Helpers', () => {
	describe('parseBip321', () => {
		it('reads just an address', () => {
			expect(parseBip321(`bitcoin:${BASE58}`)).toEqual([
				{kind: 'onchain', request: BASE58, amount_msat: null, description: null, networks: ['mainnet']},
			]);
		});

		it('gives the address the amount in msat and the message, or else the label', () => {
			const [donation] = parseBip321(`bitcoin:${BASE58}?amount=20.3&label=Luke-Jr&message=Donation%20for%20project%20xyz`)!;
			expect(donation).toEqual(jasmine.objectContaining({amount_msat: 2_030_000_000_000, description: 'Donation for project xyz'}));
			const [labelled] = parseBip321(`bitcoin:${BASE58}?label=Luke-Jr`)!;
			expect(labelled).toEqual(jasmine.objectContaining({amount_msat: null, description: 'Luke-Jr'}));
		});

		it('keeps an invoice to its own amount, the URI amount going to the address', () => {
			const [address, invoice] = parseBip321(`bitcoin:${SEGWIT}?amount=0.025&lightning=${INVOICE}`)!;
			expect(address).toEqual(jasmine.objectContaining({kind: 'onchain', amount_msat: 2_500_000_000}));
			expect(invoice).toEqual(jasmine.objectContaining({kind: 'bolt11', amount_msat: 2_500_000_000, description: 'coffee beans'}));
		});

		it('reads payment instructions with no address', () => {
			expect(parseBip321(`bitcoin:?lno=${OFFER}&sp=${SILENT_PAYMENT}`)!.map((option) => option.kind)).toEqual([
				'bolt12',
				'silent_payment',
			]);
			expect(parseBip321(`bitcoin:?creq=${CREQ_B}`)).toEqual([{kind: 'payment_request', request: CREQ_B}]);
			expect(parseBip321(`bitcoin:?lightning=${LNURL}`)).toEqual([{kind: 'lnurl', request: LNURL}]);
		});

		it('reads extra segwit addresses keyed by their prefix', () => {
			const options = parseBip321(`bitcoin:?bc=${SEGWIT}&bc=${TAPROOT}&tb=${SEGWIT}`)!;
			expect(options.map((option) => option.request)).toEqual([SEGWIT, TAPROOT]);
		});

		it('takes the scheme and keys in any case, as upper-case QR codes carry them', () => {
			const options = parseBip321(`BITCOIN:${SEGWIT.toUpperCase()}?AMOUNT=0.001&LIGHTNING=${INVOICE.toUpperCase()}`);
			expect(options).toEqual([
				jasmine.objectContaining({kind: 'onchain', request: SEGWIT, amount_msat: 100_000_000}),
				jasmine.objectContaining({kind: 'bolt11', request: INVOICE}),
			]);
		});

		it('ignores keys it does not know, and skips an instruction that is not valid', () => {
			const options = parseBip321(`bitcoin:${BASE58}?somethingyoudontunderstand=50&lightning=lnbc1nope`)!;
			expect(options.map((option) => option.kind)).toEqual(['onchain']);
		});

		it('skips an instruction that does not fit its key', () => {
			expect(parseBip321(`bitcoin:?lightning=${OFFER}&lno=${INVOICE}&sp=${SEGWIT}`)).toEqual([]);
		});

		it('marks a URI that requires a key it does not know as unsupported', () => {
			const uri = `bitcoin:${BASE58}?req-somethingyoudontunderstand=50&req-somethingelseyoudontget=999`;
			expect(parseBip321(uri)).toEqual([{kind: 'unsupported_bip321', request: uri}]);
			expect(parseBip321(`bitcoin:${BASE58}?req-amount=1`)).toEqual([jasmine.objectContaining({amount_msat: 100_000_000_000})]);
		});

		it('refuses a bad amount or bad encoding', () => {
			expect(parseBip321(`bitcoin:${BASE58}?amount=50,000.00`)).toEqual([]);
			expect(parseBip321(`bitcoin:${BASE58}?amount=0.000000001`)).toEqual([]);
			expect(parseBip321(`bitcoin:${BASE58}?label=%E0%A4%A`)).toEqual([]);
		});

		it('is null for anything but a bitcoin: URI', () => {
			expect(parseBip321(`litecoin:${BASE58}`)).toBeNull();
			expect(parseBip321(BASE58)).toBeNull();
		});
	});
});
