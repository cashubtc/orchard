/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Native Dependencies */
import type {CashuWalletOperation} from '#server/modules/cashu/wallet/saga/cashuwalletoperation.entity';
import {CashuWalletOperationService} from '#server/modules/cashu/wallet/saga/cashuwalletoperation.service';
import {CashuWalletRecoveryService} from '#server/modules/cashu/wallet/saga/cashuwalletrecovery.service';
import {CashuWalletMintService} from '#server/modules/cashu/wallet/mint/cashuwalletmint.service';
import {CashuWalletProofService} from '#server/modules/cashu/wallet/proof/cashuwalletproof.service';
import {WalletOperationState, WalletOperationType} from '#server/modules/cashu/wallet/cashuwallet.enums';
import {walletError} from '#server/modules/cashu/wallet/cashuwallet.helpers';
/* Local Dependencies */
import {CashuWalletWatchService} from './cashuwalletwatch.service.js';

describe('CashuWalletWatchService', () => {
	let service: CashuWalletWatchService;
	let operation: CashuWalletOperation;
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

	const settles = () => recovery.settleOperations.mock.calls.length;
	const pending = (changes: Partial<CashuWalletOperation> = {}) =>
		({
			id: 'op-1',
			user_id: 'user-1',
			mint_id: 'mint-1',
			unit: 'sat',
			method: 'bolt11',
			quote_id: 'quote-1',
			type: WalletOperationType.MINT,
			state: WalletOperationState.PENDING,
			...changes,
		}) as CashuWalletOperation;

	beforeEach(async () => {
		jest.clearAllMocks();
		jest.useFakeTimers({now: 0});
		operation = pending();
		nut17 = {supported: true, params: [{method: 'bolt11', unit: 'sat', commands: ['bolt11_mint_quote', 'proof_state']}]};
		socket = {};
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CashuWalletWatchService,
				{provide: CashuWalletOperationService, useValue: operation_service},
				{provide: CashuWalletRecoveryService, useValue: recovery},
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
		beforeEach(() => {
			operation = pending({type: WalletOperationType.RECEIVE, state: WalletOperationState.EXECUTING, method: null});
		});

		it('settles a watched operation at once and every 5s until it is final', async () => {
			await service.watch('user-1', 'op-1');
			await jest.advanceTimersByTimeAsync(0);
			expect(recovery.settleOperations).toHaveBeenCalledWith(['op-1']);
			await jest.advanceTimersByTimeAsync(5_000);
			expect(settles()).toBe(2);

			service.onOperationUpdated({...operation, state: WalletOperationState.FINALIZED});
			await jest.advanceTimersByTimeAsync(10_000);
			expect(settles()).toBe(2);
		});

		it('shares one watch between viewers, ending it when the last leaves', async () => {
			const first = await service.watch('user-1', 'op-1');
			const second = await service.watch('user-1', 'op-1');
			await jest.advanceTimersByTimeAsync(0);
			expect(settles()).toBe(1);

			first.release();
			first.release();
			await jest.advanceTimersByTimeAsync(5_000);
			expect(settles()).toBe(2);
			second.release();
			await jest.advanceTimersByTimeAsync(10_000);
			expect(settles()).toBe(2);
		});

		it('checks every 5s for the first five checks, then backs off to every 30s', async () => {
			await service.watch('user-1', 'op-1');
			await jest.advanceTimersByTimeAsync(20_000);
			expect(settles()).toBe(5);
			await jest.advanceTimersByTimeAsync(5_000);
			expect(settles()).toBe(5);
			await jest.advanceTimersByTimeAsync(5_000);
			expect(settles()).toBe(6);
			await jest.advanceTimersByTimeAsync(20_000);
			expect(settles()).toBe(7);
			await jest.advanceTimersByTimeAsync(30_000);
			expect(settles()).toBe(8);
			await jest.advanceTimersByTimeAsync(30_000);
			expect(settles()).toBe(9);
		});

		it('ends a watch after 30 minutes', async () => {
			await service.watch('user-1', 'op-1');
			await jest.advanceTimersByTimeAsync(30 * 60_000);
			const settled = settles();
			await jest.advanceTimersByTimeAsync(10_000);
			expect(settles()).toBe(settled);
		});

		it('returns a final operation without watching it, and refuses one outside the wallet', async () => {
			operation = pending({state: WalletOperationState.FINALIZED});
			const watched = await service.watch('user-1', 'op-1');
			expect(watched.operation.state).toBe(WalletOperationState.FINALIZED);
			await jest.advanceTimersByTimeAsync(5_000);
			expect(settles()).toBe(0);
			await expect(service.watch('user-2', 'op-1')).rejects.toEqual(walletError('Operation not found'));
		});
	});

	describe('websocket', () => {
		it('settles a bolt11 quote once the mint reports it paid, with a 30s safety poll in between', async () => {
			await service.watch('user-1', 'op-1');
			await jest.advanceTimersByTimeAsync(0);
			expect(wallet.on.mintQuoteUpdates).toHaveBeenCalledWith(['quote-1'], expect.any(Function), expect.any(Function));
			expect(settles()).toBe(1);
			socket.notify!({state: 'UNPAID'});
			await jest.advanceTimersByTimeAsync(5_000);
			expect(settles()).toBe(1);

			socket.notify!({state: 'PAID'});
			await jest.advanceTimersByTimeAsync(0);
			expect(settles()).toBe(2);
			await jest.advanceTimersByTimeAsync(30_000);
			expect(settles()).toBe(3);
		});

		it("watches a sent token's proofs, settling once one is spent", async () => {
			operation = pending({type: WalletOperationType.SEND, method: null, quote_id: null});
			await service.watch('user-1', 'op-1');
			await jest.advanceTimersByTimeAsync(0);
			expect(wallet.on.proofStateUpdates).toHaveBeenCalledWith(held, expect.any(Function), expect.any(Function));
			socket.notify!({state: 'PENDING'});
			await jest.advanceTimersByTimeAsync(0);
			expect(settles()).toBe(1);

			socket.notify!({state: 'SPENT'});
			await jest.advanceTimersByTimeAsync(0);
			expect(settles()).toBe(2);
		});

		it.each([
			['the socket is lost, polling instead', (_release: () => void) => socket.lost!(), 2],
			['the last viewer leaves', (release: () => void) => release(), 1],
		])('closes the subscription and the mint socket with it when %s', async (_label, close, settled) => {
			const {release} = await service.watch('user-1', 'op-1');
			await jest.advanceTimersByTimeAsync(0);
			close(release);
			expect(cancel).toHaveBeenCalled();
			expect(wallet.mint.disconnectWebSocket).toHaveBeenCalled();
			await jest.advanceTimersByTimeAsync(5_000);
			expect(settles()).toBe(settled);
		});

		it.each([
			['Orchard may not reach the mint that way', () => void mint_service.allowsSocket.mockResolvedValueOnce(false)],
			['the mint offers no subscription for the unit', () => void (nut17 = {supported: true, params: []})],
		])('polls instead when %s', async (_label, refuse) => {
			refuse();
			await service.watch('user-1', 'op-1');
			await jest.advanceTimersByTimeAsync(5_000);
			expect(wallet.on.mintQuoteUpdates).not.toHaveBeenCalled();
			expect(settles()).toBe(2);
		});
	});
});
