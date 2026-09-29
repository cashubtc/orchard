/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {getRepositoryToken} from '@nestjs/typeorm';
import {ConfigService} from '@nestjs/config';
/* Vendor Dependencies */
import {DataSource} from 'typeorm';
import {createBlindSignature, createNewMintKeys, pointFromHex, serializeMintKeys} from '@cashu/cashu-ts';
/* Application Dependencies */
import {FetchService} from '#server/modules/fetch/fetch.service';
/* Local Dependencies */
import {CashuWalletOperationService} from './cashuwalletoperation.service.js';
import {CashuWalletMintService} from './cashuwalletmint.service.js';
import {CashuWalletService} from './cashuwallet.service.js';
import {CashuWalletOperation} from './cashuwalletoperation.entity.js';
import {CashuWalletProof} from './cashuwalletproof.entity.js';
import {CashuWalletCounter} from './cashuwalletcounter.entity.js';
import {CashuWalletMint} from './cashuwalletmint.entity.js';
import {WalletOperationState, WalletProofState} from './cashuwallet.enums.js';

/** Minimal mint that signs outputs for real with cashu-ts crypto; `failures` queues NUT errors for /v1/mint */
const createFakeMint = () => {
	const keyset = createNewMintKeys(8, undefined, {unit: 'sat'});
	const signed = new Map<string, {id: string; amount: number; C_: string}>();
	const failures: {code: number; detail: string}[] = [];
	const info = {
		name: 'Orchard Test Mint',
		pubkey: '02orchard',
		version: 'cdk',
		contact: [],
		nuts: {4: {methods: [{method: 'bolt11', unit: 'sat'}], disabled: false}, 5: {methods: [], disabled: false}},
	};
	const keysets = {keysets: [{id: keyset.keysetId, unit: 'sat', active: true, input_fee_ppk: 0}]};
	const keys = {keysets: [{id: keyset.keysetId, unit: 'sat', active: true, keys: serializeMintKeys(keyset.pubKeys)}]};
	const sign = (output: {amount: number; id: string; B_: string}) => {
		const signature = createBlindSignature(pointFromHex(output.B_), keyset.privKeys[output.amount], output.id);
		return {id: output.id, amount: Number(output.amount), C_: signature.C_.toHex(true)};
	};
	const handle = (path: string, body: any): [number, any] => {
		if (path === '/v1/info') return [200, info];
		if (path === '/v1/keysets') return [200, keysets];
		if (path.startsWith('/v1/keys')) return [200, keys];
		if (path === '/v1/mint/bolt11') {
			const failure = failures.shift();
			if (failure) return [400, failure];
			if (body.outputs.some((output: any) => signed.has(output.B_))) return [400, {code: 11003, detail: 'Outputs already signed'}];
			const signatures = body.outputs.map((output: any) => {
				const signature = sign(output);
				signed.set(output.B_, signature);
				return signature;
			});
			return [200, {signatures}];
		}
		if (path === '/v1/restore') {
			const outputs = body.outputs.filter((output: any) => signed.has(output.B_));
			return [200, {outputs, signatures: outputs.map((output: any) => signed.get(output.B_))}];
		}
		return [404, {detail: 'not found'}];
	};
	return {keyset, failures, handle};
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
	const seed = new Uint8Array(64).fill(7);

	const request = (quote_id = 'quote-1') => ({
		user_id: 'user-1',
		mint_id: mint_row.id,
		unit: 'sat',
		amount: 100,
		method: 'bolt11',
		quote_id,
	});
	const proofs = () => data_source.getRepository(CashuWalletProof).find();
	const counter = () =>
		data_source.getRepository(CashuWalletCounter).findOneByOrFail({user_id: 'user-1', keyset_id: mint.keyset.keysetId});

	beforeEach(async () => {
		jest.clearAllMocks();
		mint = createFakeMint();
		offline = false;
		data_source = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [CashuWalletOperation, CashuWalletProof, CashuWalletCounter, CashuWalletMint],
			synchronize: true,
		});
		await data_source.initialize();
		mint_row = await data_source.getRepository(CashuWalletMint).save({
			user_id: 'user-1',
			pubkey: '02orchard',
			urls: ['https://mint.orchard.example'],
			name: 'Orchard Test Mint',
			info: null,
			info_updated_at: null,
			created_at: 0,
		});

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CashuWalletOperationService,
				CashuWalletMintService,
				{provide: CashuWalletService, useValue: {getSeed: jest.fn(async () => seed)}},
				{
					provide: ConfigService,
					useValue: {get: jest.fn((key: string) => (key === 'cashu.api' ? 'http://localhost:3338' : undefined))},
				},
				{provide: FetchService, useValue: fetch_service},
				...[CashuWalletOperation, CashuWalletProof, CashuWalletCounter, CashuWalletMint].map((entity) => ({
					provide: getRepositoryToken(entity),
					useValue: data_source.getRepository(entity),
				})),
			],
		}).compile();

		service = module.get<CashuWalletOperationService>(CashuWalletOperationService);
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
		['waits while the quote is unpaid', {code: 20001, detail: 'Quote not paid'}, WalletOperationState.EXECUTING, 'Mint error 20001'],
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
		await service.recoverOperations();
		const recovered = await data_source.getRepository(CashuWalletOperation).findOneByOrFail({id: operation.id});
		expect(recovered).toMatchObject({state: WalletOperationState.FINALIZED, error: null});
	});

	it('rebuilds outputs on fresh counters after a stale keyset rejection', async () => {
		mint.failures.push({code: 12002, detail: 'Keyset inactive'});
		const operation = await service.createMintOperation(request());
		const result = await service.executeMintOperation(operation.id);
		expect(result.state).toBe(WalletOperationState.FINALIZED);
		expect((await counter()).next).toBe(6);
		expect(JSON.parse(result.outputs!)[0].secret).not.toBe(JSON.parse(operation.outputs!)[0].secret);
	});
});
