/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {getRepositoryToken} from '@nestjs/typeorm';
/* Vendor Dependencies */
import {DataSource} from 'typeorm';
import {Mint, MintInfo, Wallet, createNewMintKeys, serializeMintKeys} from '@cashu/cashu-ts';
/* Local Dependencies */
import {CashuWalletMintCacheService} from './cashuwalletmintcache.service.js';
import {CashuWalletMintInfo} from './cashuwalletmintinfo.entity.js';
import {CashuWalletMintKeyset} from './cashuwalletmintkeyset.entity.js';

describe('CashuWalletMintCacheService', () => {
	let service: CashuWalletMintCacheService;
	let data_source: DataSource;

	const MINT_URL = 'https://mint.example';
	const active = createNewMintKeys(8, undefined, {unit: 'sat'});
	const rotated = createNewMintKeys(8, undefined, {unit: 'sat'});
	const info = new MintInfo({
		name: 'Example Mint',
		pubkey: '02example',
		version: 'cdk',
		contact: [],
		nuts: {4: {methods: [{method: 'bolt11', unit: 'sat'}], disabled: false}, 5: {methods: [], disabled: false}},
	} as any);
	const keyset = (keys: typeof active, is_active: boolean) => ({id: keys.keysetId, unit: 'sat', active: is_active, input_fee_ppk: 0});
	const keysOf = (keys: typeof active) => ({id: keys.keysetId, unit: 'sat', keys: serializeMintKeys(keys.pubKeys)});
	/** Mint serving keysets and, like /v1/keys, the keys of every active one */
	const fakeMint = (keysets: ReturnType<typeof keyset>[], keys: ReturnType<typeof keysOf>[]) =>
		({
			mintUrl: MINT_URL,
			getKeySets: jest.fn().mockResolvedValue({keysets}),
			getKeys: jest.fn().mockResolvedValue({keysets: keys}),
		}) as unknown as Mint & {getKeySets: jest.Mock; getKeys: jest.Mock};
	const keysetRows = () => data_source.getRepository(CashuWalletMintKeyset).find();
	const expireKeysets = () => data_source.getRepository(CashuWalletMintInfo).update({mint_url: MINT_URL}, {keysets_updated_at: 1});

	beforeEach(async () => {
		data_source = new DataSource({
			type: 'better-sqlite3',
			database: ':memory:',
			entities: [CashuWalletMintInfo, CashuWalletMintKeyset],
			synchronize: true,
		});
		await data_source.initialize();
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CashuWalletMintCacheService,
				{provide: getRepositoryToken(CashuWalletMintInfo), useValue: data_source.getRepository(CashuWalletMintInfo)},
				{provide: getRepositoryToken(CashuWalletMintKeyset), useValue: data_source.getRepository(CashuWalletMintKeyset)},
			],
		}).compile();
		service = module.get<CashuWalletMintCacheService>(CashuWalletMintCacheService);
		await service.saveInfo(MINT_URL, info);
	});

	afterEach(async () => {
		await data_source.destroy();
	});

	it('saves info under its URL and returns it by URL', async () => {
		await service.saveInfo(MINT_URL, info);
		const infos = await service.getInfos([MINT_URL, 'https://unknown.example']);
		expect([...infos.keys()]).toEqual([MINT_URL]);
		expect(infos.get(MINT_URL)).toMatchObject({name: 'Example Mint', pubkey: '02example', keysets_updated_at: null});
	});

	it('refreshes keysets in two requests once they are an hour old, keeping keys it already has', async () => {
		const first = fakeMint([keyset(active, true)], [keysOf(active)]);
		await service.refreshKeysets(first);
		expect(first.getKeys).toHaveBeenCalledTimes(1);

		const after_rotation = fakeMint([keyset(active, false), keyset(rotated, true)], [keysOf(rotated)]);
		await service.refreshKeysets(after_rotation);
		expect(after_rotation.getKeySets).not.toHaveBeenCalled();

		await expireKeysets();
		await service.refreshKeysets(after_rotation);
		expect(after_rotation.getKeySets).toHaveBeenCalledTimes(1);
		expect(after_rotation.getKeys).toHaveBeenCalledTimes(1);
		const rows = await keysetRows();
		expect(rows.find((row) => row.id === active.keysetId)).toMatchObject({active: false, keys: expect.any(String)});
		expect(rows.find((row) => row.id === rotated.keysetId)).toMatchObject({active: true, keys: expect.any(String)});
	});

	it("doesn't cache keys that fail to derive their keyset id", async () => {
		await service.refreshKeysets(fakeMint([keyset(active, true)], [{...keysOf(rotated), id: active.keysetId}]));
		expect(await keysetRows()).toEqual([expect.objectContaining({id: active.keysetId, keys: null})]);
	});

	it('stamps the keyset refresh from the keychain savedAt, so a keys-only save keeps the TTL', async () => {
		await service.saveKeychain({mintUrl: MINT_URL, savedAt: 1_000_000, keysets: [keyset(active, true)]});
		expect((await service.getInfos([MINT_URL])).get(MINT_URL)).toMatchObject({keysets_updated_at: 1000});
	});

	it('round-trips a cache that builds a working wallet without network calls', async () => {
		expect(await service.getWalletCache(MINT_URL)).toBeNull();
		await service.refreshKeysets(fakeMint([keyset(active, true)], [keysOf(active)]));

		const cache = await service.getWalletCache(MINT_URL);
		const wallet = new Wallet(new Mint(MINT_URL, {customRequest: jest.fn()}), {unit: 'sat'});
		wallet.loadMintFromCache(cache!.info, cache!.keychain);
		expect(wallet.getKeyset()).toMatchObject({id: active.keysetId, hasKeys: true});
		expect(wallet.getMintInfo().name).toBe('Example Mint');
	});
});
