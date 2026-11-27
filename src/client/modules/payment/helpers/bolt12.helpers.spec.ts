/* Local Dependencies */
import {decodeOffer, isBolt12Invoice} from './bolt12.helpers';

/* BOLT 12's own offer and format test vectors */
const MINIMAL = 'lno1zcss9mk8y3wkklfvevcrszlmu23kfrxh49px20665dqwmn4p72pksese';
const TESTNET =
	'lno1qgsyxjtl6luzd9t3pr62xr7eemp6awnejusgf6gw45q75vcfqqqqqqq2p32x2um5ypmx2cm5dae8x93pqthvwfzadd7jejes8q9lhc4rvjxd022zv5l44g6qah82ru5rdpnpj';
const BITCOIN_OR_LIQUID =
	'lno1qfqpge38tqmzyrdjj3x2qkdr5y80dlfw56ztq6yd9sme995g3gsxqqm0u2xq4dh3kdevrf4zg6hx8a60jv0gxe0ptgyfc6xkryqqqqqqqq9qc4r9wd6zqan9vd6x7unnzcss9mk8y3wkklfvevcrszlmu23kfrxh49px20665dqwmn4p72pksese';
const WITH_AMOUNT = 'lno1pqpzwyq2p32x2um5ypmx2cm5dae8x93pqthvwfzadd7jejes8q9lhc4rvjxd022zv5l44g6qah82ru5rdpnpj';
const WITH_CURRENCY = 'lno1qcp4256ypqpzwyq2p32x2um5ypmx2cm5dae8x93pqthvwfzadd7jejes8q9lhc4rvjxd022zv5l44g6qah82ru5rdpnpj';
const WITH_EXPIRY = 'lno1pgx9getnwss8vetrw3hhyucwq3ay997czcss9mk8y3wkklfvevcrszlmu23kfrxh49px20665dqwmn4p72pksese';
const WITH_ISSUER =
	'lno1pgx9getnwss8vetrw3hhyucjy358garswvaz7tmzdak8gvfj9ehhyeeqgf85c4p3xgsxjmnyw4ehgunfv4e3vggzamrjghtt05kvkvpcp0a79gmy3nt6jsn98ad2xs8de6sl9qmgvcvs';
const PATH_ONLY =
	'lno1pgx9getnwss8vetrw3hhyucs5ypjgef743p5fzqq9nqxh0ah7y87rzv3ud0eleps9kl2d5348hq2k8qzqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgqpqqqqqqqqqqqqqqqqqqqqqqqqqqqzqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqqzq3zyg3zyg3zygs';
const UNKNOWN_ODD = 'lno1pgx9getnwss8vetrw3hhyuckyypwa3eyt44h6txtxquqh7lz5djge4afgfjn7k4rgrkuag0jsd5xvx078wdv5gg2dpjkcmr0wahhymry';
const UNKNOWN_FEATURE = 'lno1pgx9getnwss8vetrw3hhyucvzqzqqqqqqqqqqqqqqqqqqqqqqqqpvggzamrjghtt05kvkvpcp0a79gmy3nt6jsn98ad2xs8de6sl9qmgvcvs';
const COMPLETE =
	'lno1pqps7sjqpgtyzm3qv4uxzmtsd3jjqer9wd3hy6tsw35k7msjzfpy7nz5yqcnygrfdej82um5wf5k2uckyypwa3eyt44h6txtxquqh7lz5djge4afgfjn7k4rgrkuag0jsd5xvxg';

const INVALID = {
	out_of_order: 'lno1zcssyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszpgz5znzfgdzs',
	unknown_even_type:
		'lno1pgz5znzfgdz3vggzqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpysgr0u2xq4dh3kdevrf4zg6hx8a60jv0gxe0ptgyfc6xkryqqqqqqqq',
	unknown_even_experimental_type:
		'lno1pgz5znzfgdz3vggzqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgp06wu6egp9qgr0u2xq4dh3kdevrf4zg6hx8a60jv0gxe0ptgyfc6xkryqqqqqqqq',
	type_past_79:
		'lno1pgz5znzfgdz3vggzqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgp9qgr0u2xq4dh3kdevrf4zg6hx8a60jv0gxe0ptgyfc6xkryqqqqqqqq',
	empty: 'lno1',
	truncated: 'lno1pgpyz',
	bad_chains_length: 'lno1qgqszzs9g9xyjs69zcssyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqsz',
	no_chains: 'lno1qgqpvggrt0j7j3uzp9n549hxpu0sxlmpwe2ql5qplgwkg628wrzk5acfcskq',
	bad_description_utf8: 'lno1pgpgqsgkyypqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqszqgpqyqs',
	amount_without_description: 'lno1pqpzwyqkyypwa3eyt44h6txtxquqh7lz5djge4afgfjn7k4rgrkuag0jsd5xvxg',
	currency_without_amount: 'lno1qcp4256ypgx9getnwss8vetrw3hhyuckyypwa3eyt44h6txtxquqh7lz5djge4afgfjn7k4rgrkuag0jsd5xvxg',
	zero_amount: 'lno1pqqq5qqkyyp4he0fg7pqje62jmnq78cr0ashv4q06qql58tyd9rhp3t2wuyugtq',
	no_issuer_or_path: 'lno1pgx9getnwss8vetrw3hhyuc',
	excess_padding: 'lno1zcss9mk8y3wkklfvevcrszlmu23kfrxh49px20665dqwmn4p72pkseseq',
	mixed_case:
		'LnO1PqPs7sJqPgTyZm3qV4UxZmTsD3JjQeR9Wd3hY6TsW35k7mSjZfPy7nZ5YqCnYgRfDeJ82uM5Wf5k2uCkYyPwA3EyT44h6tXtXqUqH7Lz5dJgE4AfGfJn7k4rGrKuAg0jSd5xVxG',
	trailing_join: `${COMPLETE}+`,
	leading_join: `+${COMPLETE}`,
	double_join: COMPLETE.replace('lno', 'ln++o'),
};

describe('Bolt12Helpers', () => {
	describe('decodeOffer', () => {
		it('reads a minimal offer as one for Bitcoin with nothing set', () => {
			expect(decodeOffer(MINIMAL)).toEqual({
				kind: 'bolt12',
				request: MINIMAL,
				amount_msat: null,
				currency: null,
				description: null,
				issuer: null,
				expires_at: null,
				networks: ['mainnet'],
			});
		});

		it('reads the amount, description, issuer and expiry', () => {
			expect(decodeOffer(WITH_AMOUNT)).toEqual(jasmine.objectContaining({amount_msat: 10_000, description: 'Test vectors'}));
			expect(decodeOffer(WITH_ISSUER)?.issuer).toBe('https://bolt12.org BOLT12 industries');
			expect(decodeOffer(WITH_EXPIRY)?.expires_at).toBe(2051184600);
		});

		it('keeps an amount priced in a currency apart from msat', () => {
			expect(decodeOffer(WITH_CURRENCY)).toEqual(
				jasmine.objectContaining({amount_msat: null, currency: {code: 'USD', amount: 10_000}}),
			);
		});

		it('reads the networks from the chains, dropping chains it does not know', () => {
			expect(decodeOffer(TESTNET)?.networks).toEqual(['testnet']);
			expect(decodeOffer(BITCOIN_OR_LIQUID)?.networks).toEqual(['mainnet']);
		});

		it('reads an offer reached by a blinded path alone or with unknown odd fields, leaving feature bits to the payer', () => {
			expect(decodeOffer(PATH_ONLY)).not.toBeNull();
			expect(decodeOffer(UNKNOWN_ODD)).not.toBeNull();
			expect(decodeOffer(UNKNOWN_FEATURE)).not.toBeNull();
		});

		it('joins a wrapped offer and hands it back in lower case', () => {
			const wrapped =
				'LNO1PQPS7SJQPGT+ YZM3QV4UXZMTSD3JJQER9WD3HY6TSW3+  5K7MSJZFPY7NZ5YQCN+\nYGRFDEJ82UM5WF5K2UCKYYPWA3EYT44H6TXTXQUQH7LZ5DJGE4AFGFJN7K4RGRKUAG0JSD+\r\n 5XVXG';
			expect(decodeOffer(wrapped)?.request).toBe(COMPLETE);
			expect(decodeOffer(`l+no1${COMPLETE.slice(4)}`)?.request).toBe(COMPLETE);
		});

		it('refuses what BOLT 12 tells a reader to refuse', () => {
			for (const [reason, offer] of Object.entries(INVALID)) expect(decodeOffer(offer)).withContext(reason).toBeNull();
		});

		it('refuses invoices and invoice requests, which are not offers', () => {
			expect(decodeOffer(MINIMAL.replace('lno', 'lni'))).toBeNull();
		});
	});

	describe('isBolt12Invoice', () => {
		it('recognizes invoices and invoice requests but not offers', () => {
			expect(isBolt12Invoice(MINIMAL.replace('lno', 'lni'))).toBeTrue();
			expect(isBolt12Invoice(MINIMAL.replace('lno', 'LNR').toUpperCase())).toBeTrue();
			expect(isBolt12Invoice(MINIMAL)).toBeFalse();
		});
	});
});
