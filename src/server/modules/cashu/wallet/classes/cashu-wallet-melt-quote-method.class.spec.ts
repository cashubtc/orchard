/* Core Dependencies */
import {expect} from '@jest/globals';
/* Vendor Dependencies */
import {Amount, type MeltQuoteBolt11Response, type MeltQuoteOnchainResponse, type MintInfo, type Wallet} from '@cashu/cashu-ts';
/* Local Dependencies */
import {
	CashuWalletBolt11MeltQuoteMethod,
	CashuWalletBolt12MeltQuoteMethod,
	CashuWalletMeltQuoteMethod,
	CashuWalletOnchainMeltQuoteMethod,
} from './cashu-wallet-melt-quote-method.class.js';

describe('CashuWalletMeltQuoteMethod', () => {
	const bolt11 = new CashuWalletBolt11MeltQuoteMethod();
	const bolt12 = new CashuWalletBolt12MeltQuoteMethod();
	const onchain = new CashuWalletOnchainMeltQuoteMethod();
	const lightning = {
		quote: 'melt-1',
		amount: Amount.from(25),
		expiry: 0,
		fee_reserve: Amount.from(2),
		payment_preimage: 'ff',
	} as MeltQuoteBolt11Response;
	const address = {
		quote: 'melt-2',
		amount: Amount.from(50),
		expiry: 1_000,
		fee_options: [
			{fee_index: 0, fee_reserve: Amount.from(6), estimated_blocks: 1},
			{fee_index: 1, fee_reserve: Amount.from(2), estimated_blocks: 144},
			{fee_index: 2, fee_reserve: Amount.from(1), estimated_blocks: 1.5},
		],
		outpoint: 'txid:0',
	} as unknown as MeltQuoteOnchainResponse;
	const walletIn = (unit: string) =>
		({
			unit,
			createMeltQuoteBolt11: jest.fn(async () => lightning),
			createMeltQuoteBolt12: jest.fn(async () => lightning),
			createMeltQuoteOnchain: jest.fn(async () => address),
			checkMeltQuoteBolt11: jest.fn(async () => lightning),
			checkMeltQuote: jest.fn(async () => address),
		}) as unknown as Wallet;

	it('finds the rules for a method the wallet pays by, and none for an unknown or inherited name', () => {
		expect(CashuWalletMeltQuoteMethod.find('onchain')).toBeInstanceOf(CashuWalletOnchainMeltQuoteMethod);
		expect([CashuWalletMeltQuoteMethod.find('custom'), CashuWalletMeltQuoteMethod.find('constructor')]).toEqual([null, null]);
	});

	it('takes Lightning amounts only in sat or msat, and onchain amounts in any unit', () => {
		expect(['sat', 'msat', 'usd'].map((unit) => bolt11.takesAmountIn(unit))).toEqual([true, true, false]);
		expect([bolt12.takesAmountIn('usd'), onchain.takesAmountIn('usd')]).toEqual([false, true]);
	});

	it('quotes a Lightning request with its one reserve, sending an amount in msat only when given one', async () => {
		const wallet = walletIn('sat');
		expect(await bolt11.quote(wallet, 'lnbc100n1fake', null)).toEqual({
			quote_id: 'melt-1',
			amount: 25,
			expiry: null,
			reserves: [{fee_index: null, estimated_blocks: null, fee_reserve: 2}],
		});
		await bolt11.quote(wallet, 'lnbc1fake', 25);
		expect(wallet.createMeltQuoteBolt11).toHaveBeenNthCalledWith(1, 'lnbc100n1fake', undefined);
		expect(wallet.createMeltQuoteBolt11).toHaveBeenNthCalledWith(2, 'lnbc1fake', 25_000);
	});

	it('sends a Lightning amount in msat from an msat wallet unchanged', async () => {
		const wallet = walletIn('msat');
		await bolt12.quote(wallet, 'lno1fake', 25_000);
		expect(wallet.createMeltQuoteBolt12).toHaveBeenCalledWith('lno1fake', 25_000);
	});

	it('refuses a Lightning amount that is not one in the wallet unit before converting it', async () => {
		const wallet = walletIn('sat');
		await expect(bolt11.quote(wallet, 'lnbc1fake', 2.5)).rejects.toThrow('Invalid number amount: 2.5');
		expect(wallet.createMeltQuoteBolt11).not.toHaveBeenCalled();
	});

	it('quotes an address for an amount with a reserve per speed, showing a malformed block estimate as unknown', async () => {
		const wallet = walletIn('sat');
		expect(await onchain.quote(wallet, 'bcrt1qfake', 50)).toEqual({
			quote_id: 'melt-2',
			amount: 50,
			expiry: 1_000,
			reserves: [
				{fee_index: 0, estimated_blocks: 1, fee_reserve: 6},
				{fee_index: 1, estimated_blocks: 144, fee_reserve: 2},
				{fee_index: 2, estimated_blocks: null, fee_reserve: 1},
			],
		});
		expect(wallet.createMeltQuoteOnchain).toHaveBeenCalledWith('bcrt1qfake', 50);
	});

	it("checks a quote again by id, a bolt11 invoice through cashu-ts's own call that checks its amount", async () => {
		const wallet = walletIn('sat');
		expect(await bolt11.check(wallet, 'melt-1')).toBe(lightning);
		expect(await onchain.check(wallet, 'melt-2')).toBe(address);
		expect(wallet.checkMeltQuoteBolt11).toHaveBeenCalledWith('melt-1');
		expect(wallet.checkMeltQuote).toHaveBeenCalledWith('onchain', 'melt-2');
	});

	it('picks the reserve for the way chosen to pay: the one Lightning has, or the onchain speed', () => {
		expect(bolt11.reserve(lightning, null)).toBe(2);
		expect(onchain.reserve(address, 1)).toBe(2);
	});

	it('proves payment with the preimage, or the outpoint for onchain', () => {
		expect([bolt11.paymentProof(lightning), onchain.paymentProof(address)]).toEqual(['ff', 'txid:0']);
	});

	it('asks the mint not to hold the melt open on the payment, sending the onchain speed with it', () => {
		expect(bolt11.meltOptions(null)).toEqual({preferAsync: true});
		expect(onchain.meltOptions(2)).toEqual({preferAsync: true, extraPayload: {fee_index: 2}});
	});

	it("caps one payment at the method's NUT-05 max_amount", () => {
		const info = {isSupported: jest.fn(() => ({params: [{method: 'onchain', unit: 'sat', max_amount: 600}]}))} as unknown as MintInfo;
		expect(onchain.maxAmount(info, 'sat')).toBe(600);
		expect(info.isSupported).toHaveBeenCalledWith(5);
	});
});
