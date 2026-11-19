/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Native Dependencies */
import type {CashuWalletOperation} from '#server/modules/cashu/wallet/saga/cashuwalletoperation.entity';
import {CashuWalletOperationService} from '#server/modules/cashu/wallet/saga/cashuwalletoperation.service';
import {CashuWalletRecoveryService} from '#server/modules/cashu/wallet/saga/cashuwalletrecovery.service';
import {CashuWalletMintQuoteService} from '#server/modules/cashu/wallet/mintquote/cashuwalletmintquote.service';
import {CashuWalletMintService} from '#server/modules/cashu/wallet/mint/cashuwalletmint.service';
import {CashuWalletProofService} from '#server/modules/cashu/wallet/proof/cashuwalletproof.service';
import {WalletOperationState, WalletOperationType} from '#server/modules/cashu/wallet/cashuwallet.enums';
import {walletError} from '#server/modules/cashu/wallet/helpers/cashuwalleterror.helpers';
import type {CashuWalletMintQuoteRecord} from '#server/modules/cashu/wallet/cashuwallet.types';
/* Local Dependencies */
import {CashuWalletWatchService} from './cashuwalletwatch.service.js';

describe('CashuWalletWatchService', () => {
	let service: CashuWalletWatchService;
	let operation: CashuWalletOperation;
	let quote: CashuWalletMintQuoteRecord;
	let nut17: {supported: boolean; params?: {method: string; unit: string; commands: string[]}[]};
	let socket: {notify?: (payload: {state: string}) => void; lost?: () => void};

	const recovery = {settleOperations: jest.fn(async (_operation_ids: string[]) => undefined)};
	const cancel = jest.fn();
	const subscribe = async (_items: unknown[], notify: (payload: {state: string}) => void, lost: () => void) => {
		socket = {notify, lost};
		return cancel;
	};
	const wallet = {
		getMintInfo: () => ({isSupported: () => nut17}),
		on: {mintQuoteUpdates: jest.fn(subscribe), proofStateUpdates: jest.fn(subscribe)},
		mint: {disconnectWebSocket: jest.fn()},
	};
	const mint_service = {allowsSocket: jest.fn(async () => true), getWallet: jest.fn(async () => wallet)};
	const held = [{id: '00abc', secret: 'held', C: '02c', amount: 8}];
	const proof_service = {getHeldProofs: jest.fn(async () => held)};
	const operation_service = {
		getOperation: jest.fn(async (user_id: string, id: string) => {
			if (id === operation.id && user_id === operation.user_id) return operation;
			throw walletError('Operation not found');
		}),
	};
	const mint_quote_service = {
		getQuote: jest.fn(async (user_id: string, id: string) => {
			if (id === quote.id && user_id === quote.user_id) return quote;
			throw walletError('Mint quote not found');
		}),
		settleQuotes: jest.fn(async (_quote_ids: string[]) => undefined),
		settleUpdate: jest.fn(async (_quote_id: string, _update: unknown) => undefined),
	};

	/** Ticks that settled something of a kind */
	const settles = (settle: jest.Mock<Promise<undefined>, [string[]]>) => settle.mock.calls.filter(([ids]) => ids.length > 0).length;
	const operationSettles = () => settles(recovery.settleOperations);
	const mintQuoteSettles = () => settles(mint_quote_service.settleQuotes);
	const pending = (changes: Partial<CashuWalletOperation> = {}) =>
		({
			id: 'op-1',
			user_id: 'user-1',
			mint_id: 'mint-1',
			unit: 'sat',
			method: null,
			quote_id: null,
			type: WalletOperationType.RECEIVE,
			state: WalletOperationState.EXECUTING,
			...changes,
		}) as CashuWalletOperation;
	const open = (changes: Partial<CashuWalletMintQuoteRecord> = {}) =>
		({
			id: 'quote-1',
			user_id: 'user-1',
			mint_id: 'mint-1',
			unit: 'sat',
			method: 'bolt11',
			quote_id: 'mint-quote-1',
			amount: 100,
			final: false,
			...changes,
		}) as CashuWalletMintQuoteRecord;

	beforeEach(async () => {
		jest.clearAllMocks();
		jest.useFakeTimers({now: 0});
		operation = pending();
		quote = open();
		nut17 = {supported: true, params: [{method: 'bolt11', unit: 'sat', commands: ['bolt11_mint_quote', 'proof_state']}]};
		socket = {};
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CashuWalletWatchService,
				{provide: CashuWalletOperationService, useValue: operation_service},
				{provide: CashuWalletRecoveryService, useValue: recovery},
				{provide: CashuWalletMintQuoteService, useValue: mint_quote_service},
				{provide: CashuWalletMintService, useValue: mint_service},
				{provide: CashuWalletProofService, useValue: proof_service},
			],
		}).compile();
		service = module.get(CashuWalletWatchService);
	});

	afterEach(() => {
		service.onModuleDestroy();
		jest.useRealTimers();
	});

	describe('polling', () => {
		it('settles a watched operation at once and every 5s until it is final', async () => {
			await service.watch('user-1', 'op-1');
			await jest.advanceTimersByTimeAsync(0);
			expect(recovery.settleOperations).toHaveBeenCalledWith(['op-1']);
			await jest.advanceTimersByTimeAsync(5_000);
			expect(operationSettles()).toBe(2);

			service.onOperationUpdated({...operation, state: WalletOperationState.FINALIZED});
			await jest.advanceTimersByTimeAsync(10_000);
			expect(operationSettles()).toBe(2);
		});

		it('shares one watch between viewers, ending it when the last leaves', async () => {
			const first = await service.watch('user-1', 'op-1');
			const second = await service.watch('user-1', 'op-1');
			await jest.advanceTimersByTimeAsync(0);
			expect(operationSettles()).toBe(1);

			first.release();
			first.release();
			await jest.advanceTimersByTimeAsync(5_000);
			expect(operationSettles()).toBe(2);
			second.release();
			await jest.advanceTimersByTimeAsync(10_000);
			expect(operationSettles()).toBe(2);
		});

		it('checks every 5s for the first five checks, then backs off to every 30s', async () => {
			await service.watch('user-1', 'op-1');
			await jest.advanceTimersByTimeAsync(20_000);
			expect(operationSettles()).toBe(5);
			await jest.advanceTimersByTimeAsync(5_000);
			expect(operationSettles()).toBe(5);
			await jest.advanceTimersByTimeAsync(5_000);
			expect(operationSettles()).toBe(6);
			await jest.advanceTimersByTimeAsync(20_000);
			expect(operationSettles()).toBe(7);
			await jest.advanceTimersByTimeAsync(30_000);
			expect(operationSettles()).toBe(8);
			await jest.advanceTimersByTimeAsync(30_000);
			expect(operationSettles()).toBe(9);
		});

		it('ends a watch after 30 minutes', async () => {
			await service.watch('user-1', 'op-1');
			await jest.advanceTimersByTimeAsync(30 * 60_000);
			const settled = operationSettles();
			await jest.advanceTimersByTimeAsync(10_000);
			expect(operationSettles()).toBe(settled);
		});

		it('returns a final operation without watching it, and refuses one outside the wallet', async () => {
			operation = pending({state: WalletOperationState.FINALIZED});
			const watched = await service.watch('user-1', 'op-1');
			expect(watched.operation.state).toBe(WalletOperationState.FINALIZED);
			await jest.advanceTimersByTimeAsync(5_000);
			expect(operationSettles()).toBe(0);
			await expect(service.watch('user-2', 'op-1')).rejects.toEqual(walletError('Operation not found'));
		});

		it('polls a bolt12 offer, which cashu-ts has no subscription for, until it takes no more payments', async () => {
			quote = open({method: 'bolt12', amount: null});
			await service.watchMintQuote('user-1', 'quote-1');
			await jest.advanceTimersByTimeAsync(5_000);
			expect(mint_quote_service.settleQuotes).toHaveBeenCalledWith(['quote-1']);
			expect(mintQuoteSettles()).toBe(2);
			expect(wallet.on.mintQuoteUpdates).not.toHaveBeenCalled();

			service.onMintQuoteUpdated({...quote, final: true});
			await jest.advanceTimersByTimeAsync(10_000);
			expect(mintQuoteSettles()).toBe(2);
		});

		it('returns a quote that takes no more payments without watching it, and refuses one outside the wallet', async () => {
			quote = open({final: true});
			expect((await service.watchMintQuote('user-1', 'quote-1')).quote.final).toBe(true);
			await jest.advanceTimersByTimeAsync(5_000);
			expect(mintQuoteSettles()).toBe(0);
			await expect(service.watchMintQuote('user-2', 'quote-1')).rejects.toEqual(walletError('Mint quote not found'));
		});
	});

	describe('websocket', () => {
		it('settles a bolt11 invoice from each update its mint pushes without asking again, the safety poll counting from the push', async () => {
			await service.watchMintQuote('user-1', 'quote-1');
			await jest.advanceTimersByTimeAsync(10_000);
			expect(wallet.on.mintQuoteUpdates).toHaveBeenCalledWith(['mint-quote-1'], expect.any(Function), expect.any(Function));
			expect(mintQuoteSettles()).toBe(1);

			socket.notify!({state: 'PAID'});
			expect(mint_quote_service.settleUpdate).toHaveBeenCalledWith('quote-1', {state: 'PAID'});
			await jest.advanceTimersByTimeAsync(25_000);
			expect(mintQuoteSettles()).toBe(1);
			await jest.advanceTimersByTimeAsync(5_000);
			expect(mintQuoteSettles()).toBe(2);
		});

		it("watches a sent token's proofs, settling once one is spent", async () => {
			operation = pending({type: WalletOperationType.SEND, state: WalletOperationState.PENDING});
			await service.watch('user-1', 'op-1');
			await jest.advanceTimersByTimeAsync(0);
			expect(wallet.on.proofStateUpdates).toHaveBeenCalledWith(held, expect.any(Function), expect.any(Function));
			socket.notify!({state: 'PENDING'});
			await jest.advanceTimersByTimeAsync(0);
			expect(operationSettles()).toBe(1);

			socket.notify!({state: 'SPENT'});
			await jest.advanceTimersByTimeAsync(0);
			expect(operationSettles()).toBe(2);
		});

		it('opens no socket for a mint operation, which only exists once its quote is paid', async () => {
			operation = pending({
				type: WalletOperationType.MINT,
				state: WalletOperationState.PENDING,
				method: 'bolt11',
				quote_id: 'mint-quote-1',
			});
			await service.watch('user-1', 'op-1');
			await jest.advanceTimersByTimeAsync(0);
			expect(wallet.on.mintQuoteUpdates).not.toHaveBeenCalled();
		});

		it('polls when the socket drops, then reopens it the next time the invoice is due', async () => {
			await service.watchMintQuote('user-1', 'quote-1');
			await jest.advanceTimersByTimeAsync(0);
			socket.lost!();
			expect(cancel).toHaveBeenCalled();
			expect(wallet.mint.disconnectWebSocket).toHaveBeenCalled();
			await jest.advanceTimersByTimeAsync(5_000);
			expect(mintQuoteSettles()).toBe(2);
			expect(wallet.on.mintQuoteUpdates).toHaveBeenCalledTimes(2);
			expect([mint_service.allowsSocket.mock.calls.length, mint_service.getWallet.mock.calls.length]).toEqual([1, 1]);

			socket.notify!({state: 'PAID'});
			expect(mint_quote_service.settleUpdate).toHaveBeenCalledWith('quote-1', {state: 'PAID'});
		});

		it('closes the subscription and the mint socket with it when the last viewer leaves', async () => {
			const {release} = await service.watchMintQuote('user-1', 'quote-1');
			await jest.advanceTimersByTimeAsync(0);
			release();
			expect(cancel).toHaveBeenCalled();
			expect(wallet.mint.disconnectWebSocket).toHaveBeenCalled();
			await jest.advanceTimersByTimeAsync(5_000);
			expect(mintQuoteSettles()).toBe(1);
		});

		it.each([
			['Orchard may not reach the mint that way', () => void mint_service.allowsSocket.mockResolvedValueOnce(false)],
			['the mint offers no subscription for the unit', () => void (nut17 = {supported: true, params: []})],
		])('polls instead when %s', async (_label, refuse) => {
			refuse();
			await service.watchMintQuote('user-1', 'quote-1');
			await jest.advanceTimersByTimeAsync(5_000);
			expect(wallet.on.mintQuoteUpdates).not.toHaveBeenCalled();
			expect(mintQuoteSettles()).toBe(2);
		});
	});
});
