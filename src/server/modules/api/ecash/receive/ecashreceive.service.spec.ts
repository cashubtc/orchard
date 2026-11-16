/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Vendor Dependencies */
import {PubSub} from 'graphql-subscriptions';
/* Application Dependencies */
import {CashuWalletSwapService} from '#server/modules/cashu/wallet/saga/swap/cashuwalletswap.service';
import {CashuWalletQuoteService} from '#server/modules/cashu/wallet/quote/cashuwalletquote.service';
import {CashuWalletWatchService} from '#server/modules/cashu/wallet/watch/cashuwalletwatch.service';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {OrchardEcashOperation} from '#server/modules/api/ecash/operation/ecashoperation.model';
import {WalletMintMatch} from '#server/modules/cashu/wallet/cashuwallet.enums';
/* Local Dependencies */
import {EcashReceiveService} from './ecashreceive.service.js';
import {OrchardEcashQuote, OrchardEcashTokenPreview} from './ecashreceive.model.js';
import type {EcashQuoteWatchPayload} from './ecashreceive.types.js';

describe('EcashReceiveService', () => {
	let ecashReceiveService: EcashReceiveService;
	let cashuWalletSwapService: jest.Mocked<CashuWalletSwapService>;
	let cashuWalletQuoteService: jest.Mocked<CashuWalletQuoteService>;
	let cashuWalletWatchService: jest.Mocked<CashuWalletWatchService>;
	let errorService: jest.Mocked<ErrorService>;

	const preview = {
		amount: 30,
		unit: 'sat',
		memo: 'Lunch',
		fee: 0,
		claimed: false,
		mint: {url: 'https://mint.example', info: null, latency_ms: null, time_offset: null, match: WalletMintMatch.URL, mint_id: 'mint-1'},
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				EcashReceiveService,
				{provide: CashuWalletSwapService, useValue: {previewToken: jest.fn(), receiveToken: jest.fn()}},
				{provide: CashuWalletQuoteService, useValue: {newQuote: jest.fn(), openQuote: jest.fn()}},
				{provide: CashuWalletWatchService, useValue: {watchQuote: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		ecashReceiveService = module.get<EcashReceiveService>(EcashReceiveService);
		cashuWalletSwapService = module.get(CashuWalletSwapService);
		cashuWalletQuoteService = module.get(CashuWalletQuoteService);
		cashuWalletWatchService = module.get(CashuWalletWatchService);
		errorService = module.get(ErrorService);
	});

	it('previewToken maps the preview and the mint it is from', async () => {
		cashuWalletSwapService.previewToken.mockResolvedValue(preview);
		const result = await ecashReceiveService.previewToken('TAG', 'user-1', 'cashuBtoken', false);
		expect(cashuWalletSwapService.previewToken).toHaveBeenCalledWith('user-1', 'cashuBtoken', false);
		expect(result).toBeInstanceOf(OrchardEcashTokenPreview);
		expect(result).toMatchObject({amount: 30, fee: 0, claimed: false, mint: {url: 'https://mint.example', match: WalletMintMatch.URL}});
	});

	it('receiveToken passes the mint consent through', async () => {
		cashuWalletSwapService.receiveToken.mockResolvedValue({id: 'op-1', type: 'RECEIVE', state: 'FINALIZED', amount: 30} as any);
		const result = await ecashReceiveService.receiveToken('TAG', 'user-1', 'cashuBtoken', true, false);
		expect(cashuWalletSwapService.receiveToken).toHaveBeenCalledWith('user-1', 'cashuBtoken', true, false);
		expect(result).toBeInstanceOf(OrchardEcashOperation);
	});

	it('newQuote and openQuote map the quote with what its payments brought in', async () => {
		const quote = {id: 'quote-1', method: 'bolt12', request: 'lno1offer', amount: null, received: 50, payments: 2} as any;
		cashuWalletQuoteService.newQuote.mockResolvedValue(quote);
		cashuWalletQuoteService.openQuote.mockResolvedValue(quote);
		const request = {user_id: 'user-1', mint_id: 'mint-1', method: 'bolt12', unit: 'sat', amount: null, description: null};
		const created = await ecashReceiveService.newQuote('TAG', request);
		const opened = await ecashReceiveService.openQuote('TAG', 'user-1', 'mint-1', 'bolt12', 'sat');
		expect(cashuWalletQuoteService.newQuote).toHaveBeenCalledWith(request);
		expect(cashuWalletQuoteService.openQuote).toHaveBeenCalledWith('user-1', 'mint-1', 'bolt12', 'sat');
		expect(created).toBeInstanceOf(OrchardEcashQuote);
		expect(opened).toMatchObject({id: 'quote-1', request: 'lno1offer', received: 50, payments: 2});
	});

	describe('watchEcashQuote', () => {
		const release = jest.fn();
		const quote = {
			id: 'quote-1',
			method: 'bolt11',
			request: 'lnbc1000n1fake',
			amount: 100,
			received: 0,
			payments: 0,
			final: false,
		} as any;
		let pub_sub: PubSub;
		let updates: AsyncIterableIterator<EcashQuoteWatchPayload>;

		beforeEach(() => {
			release.mockClear();
			pub_sub = new PubSub();
			updates = pub_sub.asyncIterableIterator<EcashQuoteWatchPayload>('watch');
		});

		it('sends the quote now, then each update, ending once it takes no more payments', async () => {
			cashuWalletWatchService.watchQuote.mockResolvedValue({quote, release});
			const stream = await ecashReceiveService.watchEcashQuote('TAG', 'user-1', 'quote-1', updates);
			expect(cashuWalletWatchService.watchQuote).toHaveBeenCalledWith('user-1', 'quote-1');
			expect((await stream.next()).value).toMatchObject({ecash_quote_watch: {id: 'quote-1', final: false}});

			const paid = new OrchardEcashQuote({...quote, received: 100, payments: 1, final: true});
			await pub_sub.publish('watch', {ecash_quote_watch: paid});
			expect((await stream.next()).value).toMatchObject({ecash_quote_watch: {received: 100, final: true}});
			expect(release).toHaveBeenCalledTimes(1);
			expect(await stream.next()).toMatchObject({done: true});
		});

		it('stops listening and wraps the error when the quote cannot be watched', async () => {
			cashuWalletWatchService.watchQuote.mockRejectedValue(new Error('Quote not found'));
			errorService.resolveError.mockImplementation((_logger, error) => error);
			const stop = jest.spyOn(updates, 'return');
			await expect(ecashReceiveService.watchEcashQuote('TAG', 'user-1', 'quote-9', updates)).rejects.toBeInstanceOf(OrchardApiError);
			expect(stop).toHaveBeenCalled();
		});
	});

	it('wraps failures as a wallet error', async () => {
		cashuWalletSwapService.receiveToken.mockRejectedValue(new Error('Token is not in wallet unit'));
		errorService.resolveError.mockImplementation((_logger, error) => error);
		await expect(ecashReceiveService.receiveToken('TAG', 'user-1', 'cashuBtoken', false, false)).rejects.toBeInstanceOf(
			OrchardApiError,
		);
		expect(errorService.resolveError).toHaveBeenCalledWith(
			expect.anything(),
			{code: OrchardErrorCode.EcashWalletError, details: 'Token is not in wallet unit'},
			'TAG',
			{errord: OrchardErrorCode.EcashWalletError},
		);
	});
});
