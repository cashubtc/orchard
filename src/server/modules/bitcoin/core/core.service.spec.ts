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
		const fake_json = jest.fn().mockResolvedValue(JSON.stringify({result: 'ok'}));
		fetchService.fetchWithProxy.mockResolvedValue({ok: true, text: fake_json} as any);

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
		fetchService.fetchWithProxy.mockResolvedValue({ok: true, text: jest.fn().mockResolvedValue(JSON.stringify({result: 123}))} as any);
		const out = await coreService.makeRpcRequest('getblockcount', []);
		expect(out).toBe(123);
	});

	it('makeRpcRequest surfaces the RPC error message or the raw HTTP failure', async () => {
		configService.get.mockReturnValueOnce('user');
		configService.get.mockReturnValueOnce('pass');
		configService.get.mockReturnValueOnce('http://h');
		configService.get.mockReturnValueOnce(8332 as any);
		coreService.initializeRpc();
		const rpc_error = JSON.stringify({result: null, error: {code: -28, message: 'Loading block index…'}});
		fetchService.fetchWithProxy.mockResolvedValueOnce({ok: false, status: 500, text: jest.fn().mockResolvedValue(rpc_error)} as any);
		await expect(coreService.makeRpcRequest('getblockcount', [])).rejects.toThrow('Loading block index…');
		fetchService.fetchWithProxy.mockResolvedValueOnce({
			ok: false,
			status: 401,
			statusText: 'Unauthorized',
			text: jest.fn().mockResolvedValue(''),
		} as any);
		await expect(coreService.makeRpcRequest('getblockcount', [])).rejects.toThrow('401 Unauthorized');
	});
});
