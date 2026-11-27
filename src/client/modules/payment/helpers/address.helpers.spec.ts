/* Native Dependencies */
import type {PaymentNetwork} from '@client/modules/payment/types/payment.types';
/* Local Dependencies */
import {decodeAddress, isSilentPayment} from './address.helpers';

/* BIP350's invalid segwit addresses */
const INVALID_SEGWIT = {
	unknown_prefix: 'tc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vq5zuyut',
	v1_in_bech32: 'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqh2y7hd',
	v2_in_bech32: 'tb1z0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqglt7rf',
	v16_in_bech32: 'BC1S0XLXVLHEMJA6C4DQV22UAPCTQUPFHLXM9H8Z3K2E72Q4K9HCZ7VQ54WELL',
	v0_in_bech32m: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kemeawh',
	v0_in_bech32m_testnet: 'tb1q0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vq24jc47',
	bad_checksum_character: 'bc1p38j9r5y49hruaue7wxjce0updqjuyyx0kh56v8s25huc6995vvpql3jow4',
	bad_version: 'BC130XLXVLHEMJA6C4DQV22UAPCTQUPFHLXM9H8Z3K2E72Q4K9HCZ7VQ7ZWS8R',
	one_byte_program: 'bc1pw5dgrnzv',
	forty_one_byte_program: 'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7v8n0nx0muaewav253zgeav',
	bad_v0_program: 'BC1QR508D6QEJXTDG4Y5R3ZARVARYV98GJ9P',
	mixed_case: 'tb1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vq47Zagq',
	excess_padding: 'bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7v07qwwzcrf',
	non_zero_padding: 'tb1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vpggkg4j',
	empty_data: 'bc1gmk9yu',
};
/* A BIP352 test vector */
const SILENT_PAYMENT =
	'sp1qqgste7k9hx0qftg6qmwlkqtwuy6cycyavzmzj85c6qdfhjdpdjtdgq7c2zfthc6x3a5yecwc52nxa0kfd20xuz08zyrjpfw4l2j257yq6qgnkdh5';

describe('AddressHelpers', () => {
	describe('decodeAddress', () => {
		it('reads segwit addresses of every version, handing them back in lower case', () => {
			expect(decodeAddress('BC1QW508D6QEJXTDG4Y5R3ZARVARY0C5XW7KV8F3T4')).toEqual({
				kind: 'onchain',
				request: 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4',
				amount_msat: null,
				description: null,
				networks: ['mainnet'],
			});
			expect(decodeAddress('bc1p0xlxvlhemja6c4dqv22uapctqupfhlxm9h8z3k2e72q4k9hcz7vqzk5jj0')?.networks).toEqual(['mainnet']);
			expect(decodeAddress('bc1zw508d6qejxtdg4y5r3zarvaryvaxxpcs')?.networks).toEqual(['mainnet']);
			expect(decodeAddress('BC1SW50QGDZ25J')?.request).toBe('bc1sw50qgdz25j');
		});

		it('gives every network a segwit prefix can be for', () => {
			const test_networks: PaymentNetwork[] = ['testnet', 'signet'];
			expect(decodeAddress('tb1qrp33g0q5c5txsp9arysrx4k6zdkfs4nce4xj0gdcccefvpysxf3q0sl5k7')?.networks).toEqual(test_networks);
			expect(decodeAddress('tb1pqqqqp399et2xygdj5xreqhjjvcmzhxw4aywxecjdzew6hylgvsesf3hn0c')?.networks).toEqual(test_networks);
			expect(decodeAddress('bcrt1qw46h2at4w46h2at4w46h2at4w46h2at4zdn3gn')?.networks).toEqual(['regtest']);
		});

		it('reads base58 addresses as they are, test versions covering every test network', () => {
			expect(decodeAddress('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')).toEqual(
				jasmine.objectContaining({request: '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2', networks: ['mainnet']}),
			);
			expect(decodeAddress('3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy')?.networks).toEqual(['mainnet']);
			expect(decodeAddress('mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn')?.networks).toEqual(['testnet', 'signet', 'regtest']);
			expect(decodeAddress('2MzQwSSnBHWHqSAqtTVQ6v47XtaisrJa1Vc')?.networks).toEqual(['testnet', 'signet', 'regtest']);
		});

		it('refuses the addresses BIP350 lists as invalid', () => {
			for (const [reason, address] of Object.entries(INVALID_SEGWIT)) expect(decodeAddress(address)).withContext(reason).toBeNull();
		});

		it('refuses a base58 address with a bad checksum or a version it does not know', () => {
			expect(decodeAddress('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN3')).toBeNull();
			expect(decodeAddress('LaMT348PWRnrqeeWArpwQPbuanpXDZGEUz')).toBeNull();
		});

		it('refuses a silent payment address, which is not an onchain address', () => {
			expect(decodeAddress(SILENT_PAYMENT)).toBeNull();
		});
	});

	describe('isSilentPayment', () => {
		it('recognizes a BIP352 address and nothing else', () => {
			expect(isSilentPayment(SILENT_PAYMENT)).toBeTrue();
			expect(isSilentPayment(SILENT_PAYMENT.toUpperCase())).toBeTrue();
			expect(isSilentPayment(`${SILENT_PAYMENT.slice(0, -1)}q`)).toBeFalse();
			expect(isSilentPayment('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBeFalse();
		});
	});
});
