/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {ConfigService} from '@nestjs/config';
/* Application Dependencies */
import {FetchService} from '@server/modules/fetch/fetch.service';
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
});
