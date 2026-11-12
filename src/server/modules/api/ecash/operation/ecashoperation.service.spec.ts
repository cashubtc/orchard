/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Vendor Dependencies */
import {PubSub} from 'graphql-subscriptions';
/* Application Dependencies */
import {CashuWalletOperationService} from '#server/modules/cashu/wallet/saga/cashuwalletoperation.service';
import {CashuWalletIssueService} from '#server/modules/cashu/wallet/saga/issue/cashuwalletissue.service';
import {CashuWalletWatchService} from '#server/modules/cashu/wallet/watch/cashuwalletwatch.service';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {OrchardCommonCount} from '#server/modules/api/common/entity-count.model';
import {WalletOperationState} from '#server/modules/cashu/wallet/cashuwallet.enums';
/* Local Dependencies */
import {EcashOperationService} from './ecashoperation.service.js';
import {OrchardEcashOperation} from './ecashoperation.model.js';
import type {EcashOperationWatchPayload} from './ecashoperation.types.js';

describe('EcashOperationService', () => {
	let ecashOperationService: EcashOperationService;
	let cashuWalletOperationService: jest.Mocked<CashuWalletOperationService>;
	let cashuWalletIssueService: jest.Mocked<CashuWalletIssueService>;
	let errorService: jest.Mocked<ErrorService>;

	const operation: any = {
		id: 'op-1',
		user_id: 'user-1',
		mint_id: 'mint-1',
		type: 'ISSUE',
		state: 'FINALIZED',
		method: 'bolt11',
		unit: 'sat',
		amount: 100,
		memo: 'Giveaway',
		error: null,
		quote_counter: 0,
		created_at: 1,
		updated_at: 2,
	};

	const release = jest.fn();
	const watch_service = {watch: jest.fn(async () => ({operation: {...operation, state: 'PENDING'}, release}))};
	const watchPayload = (state: string) => ({ecash_operation_watch: new OrchardEcashOperation({...operation, state})});

	beforeEach(async () => {
		jest.clearAllMocks();
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				EcashOperationService,
				{
					provide: CashuWalletOperationService,
					useValue: {listOperations: jest.fn(), countOperations: jest.fn(), getOperation: jest.fn(), getToken: jest.fn()},
				},
				{provide: CashuWalletIssueService, useValue: {issueEcash: jest.fn()}},
				{provide: CashuWalletWatchService, useValue: watch_service},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		ecashOperationService = module.get<EcashOperationService>(EcashOperationService);
		cashuWalletOperationService = module.get(CashuWalletOperationService);
		cashuWalletIssueService = module.get(CashuWalletIssueService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(ecashOperationService).toBeDefined();
	});

	it('getEcashOperations passes the filters through and maps each operation', async () => {
		cashuWalletOperationService.listOperations.mockResolvedValue([operation]);
		const filters = {states: [WalletOperationState.FINALIZED], page: 0, page_size: 5};
		const [result] = await ecashOperationService.getEcashOperations('TAG', 'user-1', filters);
		expect(cashuWalletOperationService.listOperations).toHaveBeenCalledWith('user-1', filters);
		expect(result).toBeInstanceOf(OrchardEcashOperation);
		expect(result.method).toBe('bolt11');
	});

	it('getEcashOperationCount wraps the count', async () => {
		cashuWalletOperationService.countOperations.mockResolvedValue(7);
		await expect(ecashOperationService.getEcashOperationCount('TAG', 'user-1', {})).resolves.toEqual(new OrchardCommonCount(7));
	});

	it('getEcashOperation returns one operation without its internals', async () => {
		cashuWalletOperationService.getOperation.mockResolvedValue({...operation, token: 'cashuBtoken'});
		const result = await ecashOperationService.getEcashOperation('TAG', 'user-1', 'op-1');
		expect(cashuWalletOperationService.getOperation).toHaveBeenCalledWith('user-1', 'op-1');
		expect(result).toBeInstanceOf(OrchardEcashOperation);
		expect(result).not.toHaveProperty('token');
	});

	it('getEcashOperationToken returns the token of a send', async () => {
		cashuWalletOperationService.getToken.mockResolvedValue('cashuBtoken');
		await expect(ecashOperationService.getEcashOperationToken('TAG', 'user-1', 'op-1')).resolves.toBe('cashuBtoken');
		expect(cashuWalletOperationService.getToken).toHaveBeenCalledWith('user-1', 'op-1');
	});

	it('issueEcash returns the operation without its internals', async () => {
		cashuWalletIssueService.issueEcash.mockResolvedValue(operation);
		const result = await ecashOperationService.issueEcash('TAG', 'user-1', 'sat', 100, 'Giveaway');
		expect(cashuWalletIssueService.issueEcash).toHaveBeenCalledWith({
			user_id: 'user-1',
			unit: 'sat',
			amount: 100,
			memo: 'Giveaway',
		});
		expect(result).toBeInstanceOf(OrchardEcashOperation);
		expect(result).not.toHaveProperty('quote_counter');
	});

	describe('watchEcashOperation', () => {
		let pub_sub: PubSub;
		let updates: AsyncIterableIterator<EcashOperationWatchPayload>;

		beforeEach(() => {
			pub_sub = new PubSub();
			updates = pub_sub.asyncIterableIterator<EcashOperationWatchPayload>('watch');
		});

		it("sends the operation's state now, then each update, ending with its final state", async () => {
			const stream = await ecashOperationService.watchEcashOperation('TAG', 'user-1', 'op-1', updates);
			expect((await stream.next()).value).toMatchObject({ecash_operation_watch: {id: 'op-1', state: 'PENDING'}});

			await pub_sub.publish('watch', watchPayload('EXECUTING'));
			expect((await stream.next()).value).toMatchObject({ecash_operation_watch: {state: 'EXECUTING'}});
			expect(release).not.toHaveBeenCalled();

			await pub_sub.publish('watch', watchPayload('FINALIZED'));
			expect((await stream.next()).value).toMatchObject({ecash_operation_watch: {state: 'FINALIZED'}});
			expect(release).toHaveBeenCalledTimes(1);
			expect(await stream.next()).toMatchObject({done: true});
		});

		it('releases the watch at once when returned while waiting for an update', async () => {
			const stream = await ecashOperationService.watchEcashOperation('TAG', 'user-1', 'op-1', updates);
			await stream.next();
			const waiting = stream.next();
			await stream.return!();
			expect(release).toHaveBeenCalled();
			expect(await waiting).toMatchObject({done: true});
		});

		it('stops listening and wraps the error when the operation cannot be watched', async () => {
			const not_found = {code: OrchardErrorCode.EcashWalletError, details: 'Operation not found'};
			watch_service.watch.mockRejectedValueOnce(not_found);
			errorService.resolveError.mockReturnValue(not_found);
			const stop = jest.spyOn(updates, 'return');
			await expect(ecashOperationService.watchEcashOperation('TAG', 'user-1', 'op-9', updates)).rejects.toBeInstanceOf(
				OrchardApiError,
			);
			expect(stop).toHaveBeenCalled();
		});
	});

	it('wraps issue errors as OrchardApiError', async () => {
		const wallet_error = {code: OrchardErrorCode.EcashWalletError, details: 'Mint error 11006: Amount out of limit range'};
		cashuWalletIssueService.issueEcash.mockRejectedValue(wallet_error);
		errorService.resolveError.mockReturnValue(wallet_error);
		await expect(ecashOperationService.issueEcash('TAG', 'user-1', 'sat', 1, null)).rejects.toBeInstanceOf(OrchardApiError);
	});
});
