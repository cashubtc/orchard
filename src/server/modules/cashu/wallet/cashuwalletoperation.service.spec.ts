/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {getRepositoryToken} from '@nestjs/typeorm';
import {ConfigService} from '@nestjs/config';
/* Vendor Dependencies */
import {DataSource} from 'typeorm';
import {createBlindSignature, createNewMintKeys, pointFromHex, serializeMintKeys, verifyMintQuoteSignature} from '@cashu/cashu-ts';
/* Application Dependencies */
import {FetchService} from '#server/modules/fetch/fetch.service';
import {CashuMintRpcService} from '#server/modules/cashu/mintrpc/cashumintrpc.service';
/* Local Dependencies */
import {CashuWalletOperationService} from './cashuwalletoperation.service.js';
import {CashuWalletMintService} from './cashuwalletmint.service.js';
import {CashuWalletService} from './cashuwallet.service.js';
import {CashuWalletOperation} from './cashuwalletoperation.entity.js';
import {CashuWalletProof} from './cashuwalletproof.entity.js';
import {CashuWalletCounter} from './cashuwalletcounter.entity.js';
import {CashuWalletMint} from './cashuwalletmint.entity.js';
import {CashuWalletMintInfo} from './cashuwalletmintinfo.entity.js';
import {CashuWalletMintKeyset} from './cashuwalletmintkeyset.entity.js';
import {CashuWalletMintCacheService} from './cashuwalletmintcache.service.js';
import {WalletOperationState, WalletOperationType, WalletProofState} from './cashuwallet.enums.js';
import {walletError} from './cashuwallet.helpers.js';
import type {CashuWalletOperationFilters} from './cashuwallet.types.js';

/** Minimal mint that signs outputs for real with cashu-ts crypto; `failures` queues NUT errors for /v1/mint */
const createFakeMint = () => {
	const keyset = createNewMintKeys(8, undefined, {unit: 'sat'});
	const signed = new Map<string, {id: string; amount: number; C_: string}>();
	const quotes = new Map<string, {pubkey?: string; state: string; amount: number; expiry: number | null}>();
	const failures: {code: number; detail: string}[] = [];
	const info = {
		name: 'Orchard Test Mint',
		pubkey: '02orchard',
		version: 'cdk',
		contact: [],
		nuts: {
			4: {methods: [{method: 'bolt11', unit: 'sat'}], disabled: false},
			5: {methods: [], disabled: false},
			20: {supported: true},
		},
	};
	const keysets = {keysets: [{id: keyset.keysetId, unit: 'sat', active: true, input_fee_ppk: 0}]};
	const keys = {keysets: [{id: keyset.keysetId, unit: 'sat', active: true, keys: serializeMintKeys(keyset.pubKeys)}]};
	const sign = (output: {amount: number; id: string; B_: string}) => {
		const signature = createBlindSignature(pointFromHex(output.B_), keyset.privKeys[output.amount], output.id);
		return {id: output.id, amount: Number(output.amount), C_: signature.C_.toHex(true)};
	};
	const quoteResponse = (id: string) => {
		const quote = quotes.get(id)!;
		return {quote: id, request: `lnbc${quote.amount * 10}n1fake`, unit: 'sat', ...quote};
	};
	const handle = (path: string, body: any): [number, any] => {
		if (path === '/v1/info') return [200, info];
		if (path === '/v1/keysets') return [200, keysets];
		if (path.startsWith('/v1/keys')) return [200, keys];
		if (path === '/v1/mint/quote/bolt11') {
			const quote = `quote-${quotes.size + 1}`;
			quotes.set(quote, {pubkey: body.pubkey, state: 'UNPAID', amount: body.amount, expiry: null});
			return [200, quoteResponse(quote)];
		}
		if (path.startsWith('/v1/mint/quote/bolt11/')) {
			const quote = path.split('/').pop()!;
			return quotes.has(quote) ? [200, quoteResponse(quote)] : [400, {code: 20004, detail: 'Unknown quote'}];
		}
		if (path === '/v1/mint/bolt11') {
			const failure = failures.shift();
			if (failure) return [400, failure];
			const quote = quotes.get(body.quote);
			if (quote?.state === 'UNPAID') return [400, {code: 20001, detail: 'Quote not paid'}];
			if (quote?.state === 'ISSUED') return [400, {code: 20002, detail: 'Quote already issued'}];
			if (quote?.pubkey && !verifyMintQuoteSignature(quote.pubkey, body.quote, body.outputs, body.signature ?? '')) {
				return [400, {code: 20008, detail: 'Invalid signature'}];
			}
			if (body.outputs.some((output: any) => signed.has(output.B_))) return [400, {code: 11003, detail: 'Outputs already signed'}];
			const signatures = body.outputs.map((output: any) => {
				const signature = sign(output);
				signed.set(output.B_, signature);
				return signature;
			});
			if (quote) quote.state = 'ISSUED';
			return [200, {signatures}];
		}
		if (path === '/v1/restore') {
			const outputs = body.outputs.filter((output: any) => signed.has(output.B_));
			return [200, {outputs, signatures: outputs.map((output: any) => signed.get(output.B_))}];
		}
		return [404, {detail: 'not found'}];
	};
	return {keyset, quotes, failures, handle};
};

describe('CashuWalletOperationService', () => {
	let service: CashuWalletOperationService;
	let data_source: DataSource;
	let mint: ReturnType<typeof createFakeMint>;
	let offline: boolean;
	let mint_row: CashuWalletMint;

	const fetch_service = {
		fetchWithProxy: jest.fn(async (url: string, options: any) => {
			if (offline) throw new Error('socket hang up');
			const [status, body] = mint.handle(new URL(url).pathname, options.body ? JSON.parse(options.body) : undefined);
			return {ok: status < 300, status, text: async () => JSON.stringify(body), headers: {get: () => null}};
		}),
	};
	const mint_rpc = {
		updateNut04Quote: jest.fn(async ({quote_id, state}: {quote_id: string; state: string}) => {
			mint.quotes.get(quote_id)!.state = state;
			return {quote_id, state};
		}),
	};
	const seed = new Uint8Array(64).fill(7);

	const request = (quote_id = 'quote-1') => ({
		user_id: 'user-1',
		mint_id: mint_row.id,
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
		data_source.getRepository(CashuWalletCounter).findOneByOrFail({user_id: 'user-1', counter_key: mint.keyset.keysetId});
	const reload = (id: string) => data_source.getRepository(CashuWalletOperation).findOneByOrFail({id});

	const entities = [
		CashuWalletOperation,
		CashuWalletProof,
		CashuWalletCounter,
		CashuWalletMint,
		CashuWalletMintInfo,
		CashuWalletMintKeyset,
	];

	/** A fresh service graph over the shared database, like Orchard after a restart */
	const createService = async (): Promise<CashuWalletOperationService> => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CashuWalletOperationService,
				CashuWalletMintService,
				CashuWalletMintCacheService,
				{provide: CashuWalletService, useValue: {getSeed: jest.fn(async () => seed)}},
				{
					provide: ConfigService,
					useValue: {get: jest.fn((key: string) => (key === 'cashu.api' ? 'http://localhost:3338' : undefined))},
				},
				{provide: FetchService, useValue: fetch_service},
				{provide: CashuMintRpcService, useValue: mint_rpc},
				...entities.map((entity) => ({provide: getRepositoryToken(entity), useValue: data_source.getRepository(entity)})),
			],
		}).compile();
		return module.get<CashuWalletOperationService>(CashuWalletOperationService);
	};

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
		service = await createService();
	});

	afterEach(async () => {
		await data_source.destroy();
	});

	it('journals outputs before contacting the mint, on counters that never overlap', async () => {
		const first = await service.createMintOperation(request('quote-1'));
		const second = await service.createMintOperation(request('quote-2'));
		expect(first).toMatchObject({state: WalletOperationState.PENDING, quote_id: 'quote-1', method: 'bolt11'});
		expect(JSON.parse(first.outputs!)).toHaveLength(3);
		expect((await counter()).next).toBe(6);
		expect(JSON.parse(first.outputs!)[0].secret).not.toBe(JSON.parse(second.outputs!)[0].secret);
		expect(fetch_service.fetchWithProxy).not.toHaveBeenCalledWith(expect.stringContaining('/v1/mint/bolt11'), expect.anything());
	});

	it('mints the saved outputs and stores ready proofs', async () => {
		const operation = await service.createMintOperation(request());
		const result = await service.executeMintOperation(operation.id);
		const stored = await proofs();
		expect(result.state).toBe(WalletOperationState.FINALIZED);
		expect(stored.map((proof) => proof.amount).sort((a, b) => a - b)).toEqual([4, 32, 64]);
		expect(stored.every((proof) => proof.state === WalletProofState.READY && proof.created_by_op_id === operation.id)).toBe(true);
		expect(fetch_service.fetchWithProxy.mock.calls.filter(([url]) => url.endsWith('/v1/keysets'))).toHaveLength(1);
	});

	it('loads from the mint when the cached keyset has no keys, and caches what it loaded', async () => {
		const now = Math.floor(Date.now() / 1000);
		await data_source
			.getRepository(CashuWalletMintInfo)
			.save({mint_url: 'http://localhost:3338', info: '{"name":"x","nuts":{}}', info_updated_at: now, keysets_updated_at: now});
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
		const keyset_calls = () => fetch_service.fetchWithProxy.mock.calls.filter(([url]) => /\/v1\/keys(ets)?(\/|$)/.test(url)).length;
		const before = keyset_calls();

		const restarted = await createService();
		const second = await restarted.createMintOperation(request('quote-2'));
		expect((await restarted.executeMintOperation(second.id)).state).toBe(WalletOperationState.FINALIZED);
		expect(keyset_calls()).toBe(before);
		expect(await data_source.getRepository(CashuWalletMintKeyset).findOneByOrFail({id: mint.keyset.keysetId})).toMatchObject({
			mint_url: 'http://localhost:3338',
			active: true,
			keys: expect.any(String),
		});
	});

	it('restores through NUT-09 when a replay finds its outputs already signed', async () => {
		const operation = await service.createMintOperation(request());
		await service.executeMintOperation(operation.id);
		const secrets = (await proofs()).map((proof) => proof.secret).sort();
		await data_source.getRepository(CashuWalletProof).clear();
		await data_source.getRepository(CashuWalletOperation).update({id: operation.id}, {state: WalletOperationState.EXECUTING});

		const result = await service.executeMintOperation(operation.id);
		expect(result.state).toBe(WalletOperationState.FINALIZED);
		expect((await proofs()).map((proof) => proof.secret).sort()).toEqual(secrets);
	});

	it.each([
		[
			'returns to pending while the quote is unpaid',
			{code: 20001, detail: 'Quote not paid'},
			WalletOperationState.PENDING,
			'Mint error 20001',
		],
		['fails when minting is disabled', {code: 20003, detail: 'Minting is disabled'}, WalletOperationState.FAILED, 'Mint error 20003'],
	])('%s', async (_label, failure, state, error) => {
		mint.failures.push(failure);
		const operation = await service.createMintOperation(request());
		const result = await service.executeMintOperation(operation.id);
		expect(result).toMatchObject({state, error: expect.stringContaining(error)});
		expect(await proofs()).toEqual([]);
	});

	it('stays executing when the mint is unreachable, and finishes on recovery', async () => {
		const operation = await service.createMintOperation(request());
		offline = true;
		expect((await service.executeMintOperation(operation.id)).state).toBe(WalletOperationState.EXECUTING);
		offline = false;
		await service.reconcileOperations();
		expect(await reload(operation.id)).toMatchObject({state: WalletOperationState.FINALIZED, error: null});
	});

	it('rebuilds outputs on fresh counters after a stale keyset rejection', async () => {
		mint.failures.push({code: 12002, detail: 'Keyset inactive'});
		const operation = await service.createMintOperation(request());
		const result = await service.executeMintOperation(operation.id);
		expect(result.state).toBe(WalletOperationState.FINALIZED);
		expect((await counter()).next).toBe(6);
		expect(JSON.parse(result.outputs!)[0].secret).not.toBe(JSON.parse(operation.outputs!)[0].secret);
	});

	it('issues on the Orchard mint through a NUT-20 locked quote forced paid over the mint RPC', async () => {
		const result = await service.issueEcash({user_id: 'user-1', unit: 'sat', amount: 100, memo: 'Giveaway'});
		expect(result).toMatchObject({state: WalletOperationState.FINALIZED, mint_id: mint_row.id, quote_counter: 0, memo: 'Giveaway'});
		expect(mint.quotes.get(result.quote_id!)).toMatchObject({pubkey: expect.stringMatching(/^0[23][0-9a-f]{64}$/), state: 'ISSUED'});
		expect(mint_rpc.updateNut04Quote).toHaveBeenCalledWith({quote_id: result.quote_id, state: 'PAID'});
		expect((await proofs()).reduce((sum, proof) => sum + proof.amount, 0)).toBe(100);
	});

	it('fails the issue when the mint RPC cannot mark the quote paid', async () => {
		mint_rpc.updateNut04Quote.mockRejectedValueOnce({code: 40007, details: 'quote not found'});
		const reason = 'Mint RPC could not mark the quote paid: quote not found';
		await expect(service.issueEcash({user_id: 'user-1', unit: 'sat', amount: 100, memo: null})).rejects.toEqual(walletError(reason));
		expect(await operations()).toEqual([expect.objectContaining({state: WalletOperationState.FAILED, error: reason})]);
		expect(await proofs()).toEqual([]);
	});

	describe('listOperations and countOperations', () => {
		const ids = async (filters?: CashuWalletOperationFilters) =>
			(await service.listOperations('user-1', filters)).map((operation) => operation.id);
		const seedOperations = async () => {
			const operations = await Promise.all(
				['quote-a', 'quote-b', 'quote-c'].map((quote_id) => service.createMintOperation(request(quote_id))),
			);
			const repository = data_source.getRepository(CashuWalletOperation);
			await repository.update({id: operations[0].id}, {created_at: 100, state: WalletOperationState.FINALIZED});
			await repository.update({id: operations[1].id}, {created_at: 200, state: WalletOperationState.FAILED});
			await repository.update({id: operations[2].id}, {created_at: 300});
			await repository.save({...operations[0], id: undefined, user_id: 'user-2', created_at: 400});
			return operations;
		};

		it("lists a user's operations newest first, never another user's", async () => {
			const [first, second, third] = await seedOperations();
			expect(await ids()).toEqual([third.id, second.id, first.id]);
		});

		it('filters by state and date range, and counts without paging', async () => {
			const [first, second] = await seedOperations();
			const filters = {states: [WalletOperationState.FINALIZED, WalletOperationState.FAILED], date_start: 50, date_end: 250};
			expect(await ids(filters)).toEqual([second.id, first.id]);
			expect(await ids({...filters, page: 1, page_size: 1})).toEqual([first.id]);
			expect(await service.countOperations('user-1', {...filters, page: 1, page_size: 1})).toBe(2);
		});

		it('filters by unit, mint, method and type', async () => {
			await seedOperations();
			const filters = {units: ['sat'], mint_ids: [mint_row.id], methods: ['bolt11'], types: [WalletOperationType.MINT]};
			expect(await service.countOperations('user-1', filters)).toBe(3);
			expect(await service.countOperations('user-1', {methods: ['bolt12']})).toBe(0);
		});
	});

	describe('reconcileOperations', () => {
		const pendingOn = (state: string) => {
			mint.quotes.set('quote-9', {state, amount: 100, expiry: null});
			return service.createMintOperation(request('quote-9'));
		};

		it('mints a pending operation whose quote was paid while Orchard was down', async () => {
			const operation = await pendingOn('PAID');
			await service.reconcileOperations();
			expect(await reload(operation.id)).toMatchObject({state: WalletOperationState.FINALIZED, error: null});
			expect((await proofs()).reduce((sum, proof) => sum + proof.amount, 0)).toBe(100);
		});

		it('leaves an unpaid quote pending until it expires, then fails it', async () => {
			const waiting = await pendingOn('UNPAID');
			await service.reconcileOperations();
			expect(await reload(waiting.id)).toMatchObject({state: WalletOperationState.PENDING});

			mint.quotes.get('quote-9')!.expiry = 1;
			await service.reconcileOperations();
			expect(await reload(waiting.id)).toMatchObject({state: WalletOperationState.FAILED, error: 'Mint quote expired unpaid'});
		});

		it('fails an operation whose quote was issued to outputs the mint never signed for it', async () => {
			const operation = await pendingOn('ISSUED');
			await service.reconcileOperations();
			expect(await reload(operation.id)).toMatchObject({
				state: WalletOperationState.FAILED,
				error: 'Mint quote was issued to other outputs',
			});
		});

		it('keeps a pending operation while the mint is unreachable, clearing the error once it answers', async () => {
			const operation = await pendingOn('UNPAID');
			offline = true;
			await service.reconcileOperations();
			expect(await reload(operation.id)).toMatchObject({
				state: WalletOperationState.PENDING,
				error: expect.stringContaining('socket hang up'),
			});

			offline = false;
			await service.reconcileOperations();
			expect(await reload(operation.id)).toMatchObject({state: WalletOperationState.PENDING, error: null});
		});

		it('fails a pending operation when the mint no longer knows its quote', async () => {
			const operation = await pendingOn('UNPAID');
			mint.quotes.delete('quote-9');
			await service.reconcileOperations();
			expect(await reload(operation.id)).toMatchObject({state: WalletOperationState.FAILED, error: expect.stringContaining('20004')});
		});

		it('runs one pass at a time', async () => {
			const [first, second] = [service.reconcileOperations(), service.reconcileOperations()];
			expect(first).toBe(second);
			await first;
		});
	});
});
