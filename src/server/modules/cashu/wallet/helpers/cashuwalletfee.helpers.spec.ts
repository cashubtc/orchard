/* Core Dependencies */
import {expect} from '@jest/globals';
/* Vendor Dependencies */
import {Mint, Wallet, type Proof} from '@cashu/cashu-ts';
/* Application Dependencies */
import {createFakeMint, fakeMintRequest} from '#server/test/cashu-fake-mint';
/* Local Dependencies */
import {estimateFee} from './cashuwalletfee.helpers.js';

describe('estimateFee', () => {
	let wallet: Wallet;
	let proofs: Proof[];

	beforeAll(async () => {
		const mint = createFakeMint({input_fee_ppk: 1000});
		wallet = new Wallet(new Mint('https://mint.example', {customRequest: fakeMintRequest(mint)}), {unit: 'sat'});
		await wallet.loadMint();
		const quote = await wallet.createMintQuoteBolt11(100);
		mint.mint_quotes.get(quote.quote)!.state = 'PAID';
		proofs = await wallet.mintProofsBolt11(100, quote.quote, undefined, {type: 'random', denominations: [64, 32, 4]});
	});

	it('adds the input fee of the proofs a send would pick to the surcharge', () => {
		expect(estimateFee(wallet, proofs, 90, 6)).toEqual({fee: 9, total: 99, sufficient: true});
	});

	it('prices spending every proof when they fall short', () => {
		expect(estimateFee(wallet, proofs, 95, 5)).toEqual({fee: 8, total: 103, sufficient: false});
	});
});
