/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {getRepositoryToken} from '@nestjs/typeorm';
import {ConfigService} from '@nestjs/config';
import {EventEmitter2} from '@nestjs/event-emitter';
/* Vendor Dependencies */
import {DataSource} from 'typeorm';
import {status} from '@grpc/grpc-js';
/* Application Dependencies */
import {createFakeMint, fakeMintFetch, type FakeMint} from '#server/test/cashu-fake-mint';
import {FetchService} from '#server/modules/fetch/fetch.service';
import {CashuMintRpcService} from '#server/modules/cashu/mintrpc/cashumintrpc.service';
import {UserService} from '#server/modules/user/user.service';
/* Native Dependencies */
import {CashuWalletJournalService} from '#server/modules/cashu/wallet/saga/cashuwalletjournal.service';
import {CashuWalletSwapService} from '#server/modules/cashu/wallet/saga/swap/cashuwalletswap.service';
import {CashuWalletRecoveryService} from '#server/modules/cashu/wallet/saga/cashuwalletrecovery.service';
import {CashuWalletOperation} from '#server/modules/cashu/wallet/saga/cashuwalletoperation.entity';
import {CashuWalletCounter} from '#server/modules/cashu/wallet/saga/cashuwalletcounter.entity';
import {CashuWalletProof} from '#server/modules/cashu/wallet/proof/cashuwalletproof.entity';
import {CashuWalletProofService} from '#server/modules/cashu/wallet/proof/cashuwalletproof.service';
import {CashuWalletSeedService} from '#server/modules/cashu/wallet/seed/cashuwalletseed.service';
import {CashuWalletMintService} from '#server/modules/cashu/wallet/mint/cashuwalletmint.service';
import {CashuWalletMint} from '#server/modules/cashu/wallet/mint/cashuwalletmint.entity';
import {CashuWalletMintInfo} from '#server/modules/cashu/wallet/mint/cashuwalletmintinfo.entity';
import {CashuWalletMintKeyset} from '#server/modules/cashu/wallet/mint/cashuwalletmintkeyset.entity';
import {CashuWalletMintCacheService} from '#server/modules/cashu/wallet/mint/cashuwalletmintcache.service';
import {CashuWalletMintTransportService} from '#server/modules/cashu/wallet/mint/cashuwalletminttransport.service';
import {WalletOperationState, WalletOperationType, WalletProofState} from '#server/modules/cashu/wallet/cashuwallet.enums';
import {getCounterKey, walletError} from '#server/modules/cashu/wallet/cashuwallet.helpers';
import type {CashuWalletMintRequest} from '#server/modules/cashu/wallet/cashuwallet.types';
/* Local Dependencies */
import {CashuWalletIssueService} from './cashuwalletissue.service.js';

describe('CashuWalletIssueService', () => {
	let service: CashuWalletIssueService;
	let recovery: CashuWalletRecoveryService;
	let data_source: DataSource;
	let mint: FakeMint;
	let offline: boolean;
	let mint_row: CashuWalletMint;

	const fetch_service = {
		fetchWithProxy: jest.fn(
			fakeMintFetch(
				() => mint,
				() => offline,
			),
		),
	};
	const mint_rpc = {
		updateNut04Quote: jest.fn(async ({quote_id, state}: {quote_id: string; state: string}) => {
			mint.quotes.get(quote_id)!.state = state;
			return {quote_id, state};
		}),
	};
	const seed = new Uint8Array(64).fill(7);

	const request = (quote_id = 'quote-1'): CashuWalletMintRequest => ({
		user_id: 'user-1',
		mint_id: mint_row.id,
		type: WalletOperationType.MINT,
		unit: 'sat',
		amount: 100,
		method: 'bolt11',
		quote_id,
		quote_counter: null,
		memo: null,
	});
	const operations = () => data_source.getRepository(CashuWalletOperation).find();
	const proofs = () => data_source.getRepository(CashuWalletProof).find();
	const counter = () =>
		data_source
			.getRepository(CashuWalletCounter)
			.findOneByOrFail({user_id: 'user-1', counter_key: getCounterKey(mint.keyset.keysetId)});
	const range = (start: number) => ({keysetId: mint.keyset.keysetId, start, count: 3, next: start + 3});
	const reload = (id: string) => data_source.getRepository(CashuWalletOperation).findOneByOrFail({id});
	const secrets = async () => (await proofs()).map((proof) => proof.secret).sort();
	const total = async () => (await proofs()).reduce((sum, proof) => sum + proof.amount, 0);
	const requests = (path: RegExp) => fetch_service.fetchWithProxy.mock.calls.filter(([url]) => path.test(url)).length;
	/** An operation the mint signed whose response never arrived, so it is still executing; returns it with the signed secrets */
	const signedUnconfirmed = async () => {
		const operation = await service.createMintOperation(request());
		await service.executeMintOperation(operation.id);
		const signed = await secrets();
		await data_source.getRepository(CashuWalletProof).clear();
		await data_source.getRepository(CashuWalletOperation).update({id: operation.id}, {state: WalletOperationState.EXECUTING});
		return {operation, signed};
	};

	const entities = [
		CashuWalletOperation,
		CashuWalletProof,
		CashuWalletCounter,
		CashuWalletMint,
		CashuWalletMintInfo,
		CashuWalletMintKeyset,
	];

	/** A fresh service graph over the shared database, like Orchard after a restart */
	const createModule = (): Promise<TestingModule> =>
		Test.createTestingModule({
			providers: [
				CashuWalletIssueService,
				CashuWalletSwapService,
				CashuWalletJournalService,
				CashuWalletProofService,
				CashuWalletRecoveryService,
				CashuWalletMintService,
				CashuWalletMintCacheService,
				CashuWalletMintTransportService,
				{provide: CashuWalletSeedService, useValue: {getSeed: jest.fn(async () => seed)}},
				{
					provide: ConfigService,
					useValue: {get: jest.fn((key: string) => (key === 'cashu.api' ? 'http://localhost:3338' : undefined))},
				},
				{provide: FetchService, useValue: fetch_service},
				{provide: CashuMintRpcService, useValue: mint_rpc},
				{provide: EventEmitter2, useValue: new EventEmitter2()},
				{provide: UserService, useValue: {getUserById: jest.fn()}},
				...entities.map((entity) => ({provide: getRepositoryToken(entity), useValue: data_source.getRepository(entity)})),
			],
		}).compile();

	beforeEach(async () => {
		jest.clearAllMocks();
		mint = createFakeMint();
		offline = false;
		data_source = new DataSource({type: 'better-sqlite3', database: ':memory:', entities, synchronize: true});
		await data_source.initialize();
		mint_row = await data_source.getRepository(CashuWalletMint).save({
			user_id: 'user-1',
			pubkey: '02orchard',
			urls: ['https://mint.orchard.example'],
			created_at: 0,
		});
		const module = await createModule();
		service = module.get<CashuWalletIssueService>(CashuWalletIssueService);
		recovery = module.get<CashuWalletRecoveryService>(CashuWalletRecoveryService);
	});

	afterEach(async () => {
		await data_source.destroy();
	});

	it('journals outputs before contacting the mint, on counters that never overlap', async () => {
		const first = await service.createMintOperation(request('quote-1'));
		const second = await service.createMintOperation(request('quote-2'));
		expect(first).toMatchObject({state: WalletOperationState.PENDING, quote_id: 'quote-1', method: 'bolt11'});
		expect(JSON.parse(first.preview!)).toHaveLength(3);
		expect(JSON.parse(first.counters!)).toEqual([range(0)]);
		expect((await counter()).next).toBe(6);
		expect(JSON.parse(first.preview!)[0].secret).not.toBe(JSON.parse(second.preview!)[0].secret);
		expect(fetch_service.fetchWithProxy).not.toHaveBeenCalledWith(expect.stringContaining('/v1/mint/bolt11'), expect.anything());
	});

	it('mints the saved outputs and stores ready proofs', async () => {
		const operation = await service.createMintOperation(request());
		const result = await service.executeMintOperation(operation.id);
		const stored = await proofs();
		expect(result.state).toBe(WalletOperationState.FINALIZED);
		expect(stored.map((proof) => proof.amount).sort((a, b) => a - b)).toEqual([4, 32, 64]);
		expect(stored.every((proof) => proof.state === WalletProofState.READY && proof.created_by_op_id === operation.id)).toBe(true);
		expect(requests(/\/v1\/keysets$/)).toBe(1);
	});

	it('loads from the mint when the cached keyset has no keys, and caches what it loaded', async () => {
		const now = Math.floor(Date.now() / 1000);
		await data_source.getRepository(CashuWalletMintInfo).save({
			mint_url: 'http://localhost:3338',
			pubkey: '02orchard',
			info: '{"name":"x","pubkey":"02orchard","nuts":{}}',
			info_updated_at: now,
			keysets_updated_at: now,
		});
		await data_source
			.getRepository(CashuWalletMintKeyset)
			.save({mint_url: 'http://localhost:3338', id: mint.keyset.keysetId, unit: 'sat', active: true, keys: null, updated_at: now});

		const operation = await service.createMintOperation(request());
		expect((await service.executeMintOperation(operation.id)).state).toBe(WalletOperationState.FINALIZED);
		expect(await data_source.getRepository(CashuWalletMintKeyset).findOneByOrFail({id: mint.keyset.keysetId})).toMatchObject({
			keys: expect.any(String),
		});
	});

	it('builds the wallet from the shared cache after a restart, without fetching keysets or keys again', async () => {
		const first = await service.createMintOperation(request('quote-1'));
		await service.executeMintOperation(first.id);
		const keysets = /\/v1\/keys(ets)?(\/|$)/;
		const before = requests(keysets);

		const restarted = (await createModule()).get<CashuWalletIssueService>(CashuWalletIssueService);
		const second = await restarted.createMintOperation(request('quote-2'));
		expect((await restarted.executeMintOperation(second.id)).state).toBe(WalletOperationState.FINALIZED);
		expect(requests(keysets)).toBe(before);
		expect(await data_source.getRepository(CashuWalletMintKeyset).findOneByOrFail({id: mint.keyset.keysetId})).toMatchObject({
			mint_url: 'http://localhost:3338',
			active: true,
			keys: expect.any(String),
		});
	});

	it('restores through NUT-09 when a replay finds its outputs already signed', async () => {
		const {operation, signed} = await signedUnconfirmed();
		const result = await service.executeMintOperation(operation.id);
		expect(result.state).toBe(WalletOperationState.FINALIZED);
		expect(await secrets()).toEqual(signed);
	});

	it('restores before accepting a refusal that hides outputs already signed, like CDK answering "invoice already paid"', async () => {
		const {operation, signed} = await signedUnconfirmed();
		mint.failures.push({code: 20006, detail: 'Invoice already paid or pending'});
		expect((await service.executeMintOperation(operation.id)).state).toBe(WalletOperationState.FINALIZED);
		expect(await secrets()).toEqual(signed);
	});

	it.each([
		['while the quote is unpaid', {code: 20001, detail: 'Quote not paid'}],
		['when the mint refuses the request', {code: 20003, detail: 'Minting is disabled'}],
	])('returns to pending %s', async (_label, failure) => {
		mint.failures.push(failure);
		const operation = await service.createMintOperation(request());
		const result = await service.executeMintOperation(operation.id);
		expect(result).toMatchObject({state: WalletOperationState.PENDING, error: expect.stringContaining(`Mint error ${failure.code}`)});
		expect(await proofs()).toEqual([]);
	});

	it('mints a paid quote once the mint accepts the request again', async () => {
		mint.quotes.set('quote-9', {state: 'PAID', amount: 100, expiry: null});
		mint.failures.push({code: 20003, detail: 'Minting is disabled'});
		const operation = await service.createMintOperation(request('quote-9'));
		expect((await service.executeMintOperation(operation.id)).state).toBe(WalletOperationState.PENDING);

		await recovery.reconcileOperations();
		expect(await reload(operation.id)).toMatchObject({state: WalletOperationState.FINALIZED, error: null});
		expect(await total()).toBe(100);
	});

	it.each([
		['unreachable', () => void (offline = true), 'socket hang up'],
		['timing out behind a proxy', () => void mint.outages.set('/v1/mint/bolt11', 408), 'HTTP 408'],
	])('stays executing when the mint is %s, and finishes on recovery', async (_label, break_mint, error) => {
		const operation = await service.createMintOperation(request());
		break_mint();
		expect(await service.executeMintOperation(operation.id)).toMatchObject({
			state: WalletOperationState.EXECUTING,
			error: expect.stringContaining(error),
		});
		offline = false;
		mint.outages.clear();
		await recovery.reconcileOperations();
		expect(await reload(operation.id)).toMatchObject({state: WalletOperationState.FINALIZED, error: null});
	});

	describe('stale keyset rejections', () => {
		const keyset_inactive = {code: 12002, detail: 'Keyset inactive'};

		it('rebuilds on fresh counters once a restore shows the mint signed nothing', async () => {
			mint.failures.push(keyset_inactive);
			const operation = await service.createMintOperation(request());
			const result = await service.executeMintOperation(operation.id);
			expect(result.state).toBe(WalletOperationState.FINALIZED);
			expect(requests(/\/v1\/restore$/)).toBe(1);
			expect((await counter()).next).toBe(6);
			expect(JSON.parse(result.preview!)[0].secret).not.toBe(JSON.parse(operation.preview!)[0].secret);
			expect(JSON.parse(result.counters!)).toEqual([range(3)]);
		});

		it('restores outputs the mint already signed instead of rebuilding them', async () => {
			const {operation, signed} = await signedUnconfirmed();
			mint.failures.push(keyset_inactive);
			const result = await service.executeMintOperation(operation.id);
			expect(result).toMatchObject({state: WalletOperationState.FINALIZED, preview: operation.preview});
			expect(await secrets()).toEqual(signed);
		});

		it('keeps the saved outputs while the restore cannot be made, finishing on recovery', async () => {
			const {operation, signed} = await signedUnconfirmed();
			mint.failures.push(keyset_inactive);
			mint.outages.set('/v1/restore', 503);
			const result = await service.executeMintOperation(operation.id);
			expect(result).toMatchObject({
				state: WalletOperationState.EXECUTING,
				preview: operation.preview,
				error: expect.stringContaining('HTTP 503'),
			});

			mint.outages.clear();
			await recovery.reconcileOperations();
			expect(await reload(operation.id)).toMatchObject({state: WalletOperationState.FINALIZED, preview: operation.preview});
			expect(await secrets()).toEqual(signed);
		});
	});

	it('issues on the Orchard mint through a NUT-20 locked quote forced paid over the mint RPC', async () => {
		const result = await service.issueEcash({user_id: 'user-1', unit: 'sat', amount: 100, memo: 'Giveaway'});
		expect(result).toMatchObject({
			type: WalletOperationType.ISSUE,
			state: WalletOperationState.FINALIZED,
			mint_id: mint_row.id,
			quote_counter: 0,
			memo: 'Giveaway',
		});
		expect(mint.quotes.get(result.quote_id!)).toMatchObject({pubkey: expect.stringMatching(/^0[23][0-9a-f]{64}$/), state: 'ISSUED'});
		expect(mint_rpc.updateNut04Quote).toHaveBeenCalledWith({quote_id: result.quote_id, state: 'PAID'});
		expect(await total()).toBe(100);
	});

	it('fails the issue when the mint RPC refuses to mark the quote paid', async () => {
		const refused = Object.assign(new Error('7 PERMISSION_DENIED: Mint quote state override is disabled'), {
			code: status.PERMISSION_DENIED,
		});
		mint_rpc.updateNut04Quote.mockRejectedValueOnce(refused);
		const reason = 'Mint RPC could not mark the quote paid: 7 PERMISSION_DENIED: Mint quote state override is disabled';
		await expect(service.issueEcash({user_id: 'user-1', unit: 'sat', amount: 100, memo: null})).rejects.toEqual(walletError(reason));
		expect(await operations()).toEqual([expect.objectContaining({state: WalletOperationState.FAILED, error: reason})]);
		expect(await proofs()).toEqual([]);
	});

	it('keeps the issue pending when the mint RPC response is lost, finishing it once reconciliation finds the quote paid', async () => {
		mint_rpc.updateNut04Quote.mockImplementationOnce(async ({quote_id}: {quote_id: string}) => {
			mint.quotes.get(quote_id)!.state = 'PAID';
			throw {code: 40005, details: 'Connection dropped'};
		});
		await expect(service.issueEcash({user_id: 'user-1', unit: 'sat', amount: 100, memo: null})).rejects.toMatchObject({
			details: expect.stringContaining('completes on its own'),
		});
		const [operation] = await operations();
		expect(operation).toMatchObject({state: WalletOperationState.PENDING, error: expect.stringContaining('Connection dropped')});

		await recovery.reconcileOperations();
		expect(await reload(operation.id)).toMatchObject({state: WalletOperationState.FINALIZED, error: null});
		expect(await total()).toBe(100);
	});

	describe('reconcileOperations', () => {
		const pendingOn = (state: string) => {
			mint.quotes.set('quote-9', {state, amount: 100, expiry: null});
			return service.createMintOperation(request('quote-9'));
		};

		it('mints a pending operation whose quote was paid while Orchard was down', async () => {
			const operation = await pendingOn('PAID');
			await recovery.reconcileOperations();
			expect(await reload(operation.id)).toMatchObject({state: WalletOperationState.FINALIZED, error: null});
			expect(await total()).toBe(100);
		});

		it('leaves an unpaid quote pending until it expires, then fails it', async () => {
			const waiting = await pendingOn('UNPAID');
			await recovery.reconcileOperations();
			expect(await reload(waiting.id)).toMatchObject({state: WalletOperationState.PENDING});

			mint.quotes.get('quote-9')!.expiry = 1;
			await recovery.reconcileOperations();
			expect(await reload(waiting.id)).toMatchObject({state: WalletOperationState.FAILED, error: 'Mint quote expired unpaid'});
		});

		it('fails an operation whose quote was issued to outputs the mint never signed for it', async () => {
			const operation = await pendingOn('ISSUED');
			await recovery.reconcileOperations();
			expect(await reload(operation.id)).toMatchObject({
				state: WalletOperationState.FAILED,
				error: 'Mint quote was issued to other outputs',
			});
		});

		it.each([
			['unreachable', () => void (offline = true), 'socket hang up'],
			['behind a proxy error page', () => void mint.outages.set('/v1/mint/quote/bolt11/quote-9', 404), 'HTTP 404'],
		])('keeps a pending operation while the mint is %s, clearing the error once it answers', async (_label, break_mint, error) => {
			const operation = await pendingOn('UNPAID');
			break_mint();
			await recovery.reconcileOperations();
			expect(await reload(operation.id)).toMatchObject({state: WalletOperationState.PENDING, error: expect.stringContaining(error)});

			offline = false;
			mint.outages.clear();
			await recovery.reconcileOperations();
			expect(await reload(operation.id)).toMatchObject({state: WalletOperationState.PENDING, error: null});
		});

		it('fails a pending operation when the mint no longer knows its quote', async () => {
			const operation = await pendingOn('UNPAID');
			mint.quotes.delete('quote-9');
			await recovery.reconcileOperations();
			expect(await reload(operation.id)).toMatchObject({state: WalletOperationState.FAILED, error: expect.stringContaining('20004')});
		});
	});
});
