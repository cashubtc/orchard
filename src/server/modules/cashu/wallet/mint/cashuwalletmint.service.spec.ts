/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {getRepositoryToken} from '@nestjs/typeorm';
import {ConfigService} from '@nestjs/config';
/* Application Dependencies */
import {FetchService} from '#server/modules/fetch/fetch.service';
/* Local Dependencies */
import {CashuWalletMintService} from './cashuwalletmint.service.js';
import {CashuWalletMintCacheService} from './cashuwalletmintcache.service.js';
import {CashuWalletMintTransportService} from './cashuwalletminttransport.service.js';
import {CashuWalletMint} from './cashuwalletmint.entity.js';
import {CashuWalletProof} from '../proof/cashuwalletproof.entity.js';
import {CashuWalletOperation} from '../saga/cashuwalletoperation.entity.js';

describe('CashuWalletMintService', () => {
	let service: CashuWalletMintService;
	let rows: CashuWalletMint[];
	let config: Record<string, string | undefined>;
	let routes: Record<string, (options?: any) => Promise<any>>;

	const ORCHARD_API = 'http://localhost:3338';
	const nuts = {4: {methods: [{method: 'bolt11', unit: 'sat'}], disabled: false}, 5: {methods: [], disabled: false}};
	const orchard_info = {
		name: 'Orchard Test Mint',
		pubkey: '02orchard',
		version: 'cdk',
		contact: [],
		urls: ['https://Mint.Orchard.example/'],
		nuts,
	};
	const cedar_info = {name: 'Cedar Mint', pubkey: '02cedar', version: 'cdk', contact: [], nuts};

	const response = (body: any, status = 200, headers: Record<string, string> = {}) => ({
		ok: status >= 200 && status < 300,
		status,
		text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
		headers: {get: (name: string) => headers[name] ?? null},
	});
	const route = (url: string, respond: (options?: any) => Promise<any>) => (routes[`${url}/v1/info`] = respond);
	const lookedUp = () => fetch_service.fetchWithProxy.mock.calls.map(([url]) => url).filter((url) => !url.startsWith(ORCHARD_API));

	const mint_repository = {
		find: jest.fn(async ({where}: any) => rows.filter((row) => row.user_id === where.user_id)),
		findOne: jest.fn(async ({where}: any) => rows.find((row) => row.id === where.id && row.user_id === where.user_id) ?? null),
		create: jest.fn((data: any) => ({...data})),
		save: jest.fn(async (mint: any) => {
			if (!mint.id) {
				mint.id = `mint-${rows.length + 1}`;
				rows.push(mint);
			}
			return mint;
		}),
		delete: jest.fn(async ({id}: any) => {
			rows = rows.filter((row) => row.id !== id);
		}),
	};
	const cached_infos = new Map<string, {name: string | null; info: string}>();
	const cache_service = {
		getInfos: jest.fn(
			async (urls: string[]) => new Map(urls.filter((url) => cached_infos.has(url)).map((url) => [url, cached_infos.get(url)])),
		),
		saveInfo: jest.fn(async (url: string, info: {name?: string}) => void cached_infos.set(url, {name: info.name || null, info: '{}'})),
		refreshKeysets: jest.fn().mockResolvedValue(undefined),
	};
	const proof_repository = {count: jest.fn()};
	const operation_repository = {count: jest.fn()};
	const fetch_service = {
		fetchWithProxy: jest.fn((url: string, options?: any) =>
			routes[url] ? routes[url](options) : Promise.reject(new Error(`no route for ${url}`)),
		),
	};

	beforeEach(async () => {
		jest.clearAllMocks();
		rows = [];
		routes = {};
		cached_infos.clear();
		route(ORCHARD_API, async () => response(orchard_info));
		config = {'cashu.api': ORCHARD_API, 'server.proxy': undefined};
		proof_repository.count.mockResolvedValue(0);
		operation_repository.count.mockResolvedValue(0);

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CashuWalletMintService,
				CashuWalletMintTransportService,
				{provide: getRepositoryToken(CashuWalletMint), useValue: mint_repository},
				{provide: getRepositoryToken(CashuWalletProof), useValue: proof_repository},
				{provide: getRepositoryToken(CashuWalletOperation), useValue: operation_repository},
				{provide: ConfigService, useValue: {get: jest.fn((key: string) => config[key])}},
				{provide: FetchService, useValue: fetch_service},
				{provide: CashuWalletMintCacheService, useValue: cache_service},
			],
		}).compile();

		service = module.get<CashuWalletMintService>(CashuWalletMintService);
	});

	describe('listMints', () => {
		it('adds the Orchard mint once, with its public URLs, and flags it', async () => {
			const first = await service.listMints('user-1');
			await service.listMints('user-1');
			expect(rows).toHaveLength(1);
			expect(first[0]).toMatchObject({pubkey: '02orchard', urls: ['https://mint.orchard.example'], is_orchard: true});
		});

		it('falls back to MINT_API when the mint lists no public URLs', async () => {
			route(ORCHARD_API, async () => response({...orchard_info, urls: []}));
			const [mint] = await service.listMints('user-1');
			expect(mint.urls).toEqual([ORCHARD_API]);
		});

		it('lists without the Orchard mint while it is unreachable, and retries after 30s', async () => {
			const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
			route(ORCHARD_API, () => Promise.reject(new Error('ECONNREFUSED')));
			expect(await service.listMints('user-1')).toEqual([]);
			route(ORCHARD_API, async () => response(orchard_info));
			expect(await service.listMints('user-1')).toEqual([]);
			now.mockReturnValue(1_030_001);
			expect(await service.listMints('user-1')).toHaveLength(1);
			now.mockRestore();
		});

		it('recognizes the Orchard mint by pubkey after its URLs change', async () => {
			rows = [
				{id: 'mint-1', user_id: 'user-1', pubkey: '02orchard', urls: ['https://old.example'], created_at: 0} as CashuWalletMint,
			];
			const mints = await service.listMints('user-1');
			expect(mints).toHaveLength(1);
			expect(mints[0].is_orchard).toBe(true);
		});

		it('falls back to URL recognition when the Orchard mint publishes no pubkey', async () => {
			route(ORCHARD_API, async () => response({...orchard_info, pubkey: undefined}));
			rows = [
				{id: 'mint-1', user_id: 'user-1', pubkey: null, urls: ['https://mint.orchard.example'], created_at: 0} as CashuWalletMint,
			];
			const mints = await service.listMints('user-1');
			expect(mints).toHaveLength(1);
			expect(mints[0].is_orchard).toBe(true);
		});

		it('joins the cached info of the URL each mint is reached at', async () => {
			cache_service.getInfos.mockResolvedValueOnce(new Map([[ORCHARD_API, {name: 'Orchard Test Mint', info: '{"name":"x"}'}]]));
			const [mint] = await service.listMints('user-1');
			expect(cache_service.getInfos).toHaveBeenCalledWith([ORCHARD_API]);
			expect(mint).toMatchObject({name: 'Orchard Test Mint', info: '{"name":"x"}'});
		});

		it('skips the Orchard mint when none is configured', async () => {
			config['cashu.api'] = undefined;
			expect(await service.listMints('user-1')).toEqual([]);
			expect(fetch_service.fetchWithProxy).not.toHaveBeenCalled();
		});
	});

	describe('addMint', () => {
		it.each([
			['its public URL', 'https://mint.orchard.example/'],
			['its internal MINT_API URL', ORCHARD_API],
		])('returns the Orchard mint for %s without looking the URL up', async (_label, url) => {
			const mint = await service.addMint('user-1', url);
			expect(mint).toMatchObject({is_orchard: true, urls: ['https://mint.orchard.example']});
			expect(lookedUp()).toEqual([]);
		});

		it("refuses a URL claiming the Orchard mint's pubkey that the mint doesn't publish", async () => {
			route('https://203.0.113.20', async () => response({...cedar_info, pubkey: '02orchard'}));
			await expect(service.addMint('user-1', 'https://203.0.113.20')).rejects.toMatchObject({
				details: expect.stringContaining('claims to be your Orchard mint'),
			});
		});

		it('looks up a public mint through the transport with a timeout, size cap and no redirects', async () => {
			route('https://203.0.113.10', async () => response(cedar_info));
			const mint = await service.addMint('user-1', 'https://203.0.113.10/');
			expect(fetch_service.fetchWithProxy).toHaveBeenCalledWith(
				'https://203.0.113.10/v1/info',
				expect.objectContaining({method: 'GET', redirect: 'error', signal: expect.any(AbortSignal), size: 262144}),
			);
			expect(mint).toMatchObject({name: 'Cedar Mint', pubkey: '02cedar', urls: ['https://203.0.113.10'], is_orchard: false});
		});

		it('adds a second URL to the mint with the same pubkey', async () => {
			route('https://203.0.113.10', async () => response(cedar_info));
			route('https://203.0.113.11', async () => response(cedar_info));
			await service.addMint('user-1', 'https://203.0.113.10');
			const mint = await service.addMint('user-1', 'https://203.0.113.11');
			expect(mint.urls).toEqual(['https://203.0.113.10', 'https://203.0.113.11']);
			expect(rows.filter((row) => row.pubkey === '02cedar')).toHaveLength(1);
		});

		it.each([
			['http://203.0.113.10', 'must use https'],
			['https://10.0.0.5', 'private/reserved'],
			['https://[::1]', 'private/reserved'],
			['https://[::ffff:192.168.1.1]', 'private/reserved'],
			['https://localhost', 'localhost'],
			['http://abcdefghijklmnop.onion', 'need a Tor proxy'],
			['ftp://203.0.113.10', 'Invalid mint URL'],
		])('refuses %s', async (url, message) => {
			await expect(service.addMint('user-1', url)).rejects.toMatchObject({details: expect.stringContaining(message)});
			expect(lookedUp()).toEqual([]);
		});

		it('allows onion mints when a Tor proxy is configured', async () => {
			config['server.proxy'] = 'socks5h://127.0.0.1:9050';
			route('http://abcdefghijklmnop.onion', async () => response(cedar_info));
			await expect(service.addMint('user-1', 'http://abcdefghijklmnop.onion')).resolves.toMatchObject({name: 'Cedar Mint'});
		});

		it.each([
			['a network failure', () => Promise.reject(new Error('socket hang up')), 'socket hang up'],
			['a NUT error', async () => response({code: 20003, detail: 'Minting is disabled'}, 400), 'Minting is disabled'],
			['rate limiting', async () => response('', 429, {'Retry-After': '5'}), '429 Too Many Requests'],
			['an HTTP error', async () => response('', 404), 'HTTP 404'],
			['invalid info', async () => response({hello: 'world'}), 'Invalid response from mint'],
		])('explains a failed lookup: %s', async (_label, respond, message) => {
			route('https://203.0.113.10', respond);
			await expect(service.addMint('user-1', 'https://203.0.113.10')).rejects.toMatchObject({
				details: expect.stringContaining(message),
			});
		});
	});

	describe('checkMints', () => {
		const addRow = (id: string, url: string) => rows.push({id, user_id: 'user-1', pubkey: `02${id}`, urls: [url]} as CashuWalletMint);

		it('reports each mint online or offline with the reason, checking them all', async () => {
			route('https://203.0.113.10', async () => response(cedar_info));
			const refused = Object.assign(new Error('request to https://203.0.113.11/v1/info failed, reason: '), {code: 'ECONNREFUSED'});
			route('https://203.0.113.11', () => Promise.reject(refused));
			addRow('cedar', 'https://203.0.113.10');
			addRow('kelp', 'https://203.0.113.11');
			addRow('lan', 'https://10.0.0.9');

			expect(await service.checkMints('user-1')).toMatchObject([
				{mint_id: 'cedar', online: true, latency_ms: expect.any(Number), error: null},
				{mint_id: 'kelp', online: false, latency_ms: null, error: 'https://203.0.113.11/v1/info: ECONNREFUSED'},
				{mint_id: 'lan', online: false, error: expect.stringContaining('private/reserved')},
				{online: true},
			]);
			expect(lookedUp()).not.toContain('https://10.0.0.9/v1/info');
		});

		it('shares a status for 60s, saving fresh info and refreshing keysets only when the mint answers', async () => {
			const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
			route('https://203.0.113.10', async () => response(cedar_info));
			route('https://203.0.113.11', () => Promise.reject(new Error('socket hang up')));
			addRow('cedar', 'https://203.0.113.10');
			addRow('kelp', 'https://203.0.113.11');
			const cedarChecks = () => lookedUp().filter((url) => url === 'https://203.0.113.10/v1/info').length;

			await service.checkMints('user-1');
			await service.checkMints('user-1');
			expect(cedarChecks()).toBe(1);
			expect(cache_service.saveInfo).toHaveBeenCalledWith('https://203.0.113.10', expect.objectContaining({name: 'Cedar Mint'}));
			expect(cache_service.saveInfo).not.toHaveBeenCalledWith('https://203.0.113.11', expect.anything());
			expect(cache_service.refreshKeysets).toHaveBeenCalledWith(expect.objectContaining({mintUrl: 'https://203.0.113.10'}));
			expect(cache_service.refreshKeysets).not.toHaveBeenCalledWith(expect.objectContaining({mintUrl: 'https://203.0.113.11'}));

			now.mockReturnValue(1_060_001);
			await service.checkMints('user-1');
			expect(cedarChecks()).toBe(2);
			now.mockRestore();
		});
	});

	describe('getMint', () => {
		it('reaches the Orchard mint through MINT_API', async () => {
			const [orchard] = await service.listMints('user-1');
			expect((await service.getMint(orchard)).mintUrl).toBe(ORCHARD_API);
		});

		it('re-checks the address of other mints on every request', async () => {
			const client = await service.getMint({urls: ['https://10.0.0.9'], pubkey: '02other'} as CashuWalletMint);
			await expect(client.getInfo()).rejects.toThrow('private/reserved');
			expect(lookedUp()).toEqual([]);
		});
	});

	describe('removeMint', () => {
		beforeEach(async () => {
			route('https://203.0.113.10', async () => response(cedar_info));
			await service.listMints('user-1');
			await service.addMint('user-1', 'https://203.0.113.10');
		});

		it('refuses the Orchard mint', async () => {
			await expect(service.removeMint('user-1', 'mint-1')).rejects.toMatchObject({
				details: expect.stringContaining('cannot be removed'),
			});
		});

		it('refuses a mint that still holds ecash or has operations in progress', async () => {
			proof_repository.count.mockResolvedValueOnce(2);
			await expect(service.removeMint('user-1', 'mint-2')).rejects.toMatchObject({
				details: expect.stringContaining('still holds ecash'),
			});
			operation_repository.count.mockResolvedValueOnce(1);
			await expect(service.removeMint('user-1', 'mint-2')).rejects.toMatchObject({details: expect.stringContaining('in progress')});
		});

		it("removes an empty mint and never another user's", async () => {
			await expect(service.removeMint('user-2', 'mint-2')).rejects.toMatchObject({details: 'Mint not found in this wallet'});
			await service.removeMint('user-1', 'mint-2');
			expect(rows.map((row) => row.id)).toEqual(['mint-1']);
		});
	});
});
