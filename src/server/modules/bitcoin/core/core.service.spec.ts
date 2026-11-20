/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {ConfigService} from '@nestjs/config';
/* Application Dependencies */
import {FetchService} from '#server/modules/fetch/fetch.service';
/* Local Dependencies */
import {CoreService} from './core.service.js';

describe('CoreService', () => {
	let coreService: CoreService;
	let configService: jest.Mocked<ConfigService>;
	let fetchService: jest.Mocked<FetchService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CoreService,
				{provide: ConfigService, useValue: {get: jest.fn()}},
				{provide: FetchService, useValue: {fetchWithProxy: jest.fn()}},
			],
		}).compile();

		coreService = module.get<CoreService>(CoreService);
		configService = module.get(ConfigService);
		fetchService = module.get(FetchService);
	});

	it('should be defined', () => {
		expect(coreService).toBeDefined();
	});

	it('initializeRpc builds rpc url and auth headers', async () => {
		configService.get.mockImplementation((key: string) => {
			switch (key) {
				case 'bitcoin.user':
					return 'rpcuser';
				case 'bitcoin.pass':
					return 'rpcpass';
				case 'bitcoin.host':
					return 'http://127.0.0.1';
				case 'bitcoin.port':
					return 18443;
				default:
					return undefined as any;
			}
		});
		// mock response of fetch
		const fake_json = jest.fn().mockResolvedValue({result: 'ok'});
		fetchService.fetchWithProxy.mockResolvedValue({json: fake_json} as any);

		coreService.initializeRpc();
		await coreService.makeRpcRequest('getblockcount', []);

		const [url, options] = fetchService.fetchWithProxy.mock.calls[0];
		expect(url).toBe('http://127.0.0.1:18443/');
		expect(options.method).toBe('POST');
		expect(options.headers['Content-Type']).toBe('application/json');
		expect(options.headers.Authorization).toMatch(/^Basic /);
		// body contains method and params
		const body_obj = JSON.parse(options.body);
		expect(body_obj.method).toBe('getblockcount');
		expect(body_obj.params).toEqual([]);
	});

	it('makeRpcRequest returns inner result', async () => {
		// minimal setup to avoid dependency on initializeRpc assertions
		configService.get.mockReturnValueOnce('user');
		configService.get.mockReturnValueOnce('pass');
		configService.get.mockReturnValueOnce('http://h');
		configService.get.mockReturnValueOnce(8332 as any);
		coreService.initializeRpc();
		fetchService.fetchWithProxy.mockResolvedValue({json: jest.fn().mockResolvedValue({result: 123})} as any);
		const out = await coreService.makeRpcRequest('getblockcount', []);
		expect(out).toBe(123);
	});

	describe('a failing node', () => {
		const strict = {strict: true, timeout_ms: 20};

		beforeEach(() => {
			configService.get.mockReturnValue('x');
			coreService.initializeRpc();
		});

		it('rethrows a transport error untouched by default, and names it by method when strict', async () => {
			const refused = Object.assign(new Error('request to http://x:x/ failed, reason: connect ECONNREFUSED'), {code: 'ECONNREFUSED'});
			fetchService.fetchWithProxy.mockRejectedValue(refused);
			await expect(coreService.makeRpcRequest('getblockcount', [])).rejects.toBe(refused);
			await expect(coreService.makeRpcRequest('getblockcount', [], strict)).rejects.toThrow(
				'Bitcoin RPC getblockcount: ECONNREFUSED',
			);
		});

		it('leaves a node error to the caller by default, and throws it named by method when strict', async () => {
			const reply = {result: null, error: {code: -5, message: 'No such mempool or blockchain transaction'}};
			fetchService.fetchWithProxy.mockResolvedValue({status: 500, json: jest.fn().mockResolvedValue(reply)} as any);
			await expect(coreService.makeRpcRequest('gettxout', [])).resolves.toBeNull();
			await expect(coreService.makeRpcRequest('gettxout', [], strict)).rejects.toThrow(
				'Bitcoin RPC gettxout: No such mempool or blockchain transaction',
			);
		});

		it('names the HTTP status of a reply that is not JSON, as for rejected credentials', async () => {
			const json = jest.fn().mockRejectedValue(new SyntaxError('Unexpected end of JSON input'));
			fetchService.fetchWithProxy.mockResolvedValue({status: 401, json} as any);
			await expect(coreService.makeRpcRequest('getblockchaininfo', [], strict)).rejects.toThrow(
				'Bitcoin RPC getblockchaininfo: HTTP 401',
			);
		});

		it('gives up on a node that never answers once the timeout passes', async () => {
			fetchService.fetchWithProxy.mockImplementation(
				(_url: string, {signal}: any) =>
					new Promise((_, reject) => signal.addEventListener('abort', () => reject(new Error('The operation was aborted.')))),
			);
			await expect(coreService.makeRpcRequest('getblockchaininfo', [], strict)).rejects.toThrow(
				'Bitcoin RPC getblockchaininfo: timed out after 20ms',
			);
		});
	});
});
