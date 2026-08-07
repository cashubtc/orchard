/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Local Dependencies */
import {CashuMintApiService} from './cashumintapi.service.js';
import {ConfigService} from '@nestjs/config';
import {FetchService} from '#server/modules/fetch/fetch.service';

describe('CashuMintApiService', () => {
	let cashuMintApiService: CashuMintApiService;
	let configService: jest.Mocked<ConfigService>;
	let fetchService: jest.Mocked<FetchService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CashuMintApiService,
				{provide: ConfigService, useValue: {get: jest.fn()}},
				{provide: FetchService, useValue: {fetchWithProxy: jest.fn().mockResolvedValue({json: jest.fn()})}},
			],
		}).compile();

		cashuMintApiService = module.get<CashuMintApiService>(CashuMintApiService);
		configService = module.get(ConfigService);
		fetchService = module.get(FetchService);
	});

	it('should be defined', () => {
		expect(cashuMintApiService).toBeDefined();
	});

	it('fetches mint info from configured endpoint', async () => {
		configService.get.mockReturnValue('https://mint');
		const json = jest.fn().mockResolvedValue({name: 'Mint'});
		fetchService.fetchWithProxy.mockResolvedValue({json} as any);
		const out = await cashuMintApiService.getMintInfo();
		expect(fetchService.fetchWithProxy).toHaveBeenCalledWith('https://mint/v1/info', {
			method: 'GET',
			headers: {'Content-Type': 'application/json'},
		});
		expect(out).toEqual({name: 'Mint'});
	});

	it('calls config with expected key and parses json once', async () => {
		configService.get.mockReturnValue('https://mint');
		const json = jest.fn().mockResolvedValue({ok: true});
		fetchService.fetchWithProxy.mockResolvedValue({json} as any);
		await cashuMintApiService.getMintInfo();
		expect(configService.get).toHaveBeenCalledTimes(1);
		expect(configService.get).toHaveBeenCalledWith('cashu.api');
		expect(json).toHaveBeenCalledTimes(1);
	});

	it('propagates fetchWithProxy rejection', async () => {
		configService.get.mockReturnValue('https://mint');
		fetchService.fetchWithProxy.mockRejectedValueOnce(new Error('network'));
		await expect(cashuMintApiService.getMintInfo()).rejects.toThrow('network');
	});

	it('propagates response.json rejection', async () => {
		configService.get.mockReturnValue('https://mint');
		const json = jest.fn().mockRejectedValueOnce(new Error('bad json'));
		fetchService.fetchWithProxy.mockResolvedValue({json} as any);
		await expect(cashuMintApiService.getMintInfo()).rejects.toThrow('bad json');
	});

	it('builds request url without trailing slash', async () => {
		configService.get.mockReturnValue('https://mint');
		const json = jest.fn().mockResolvedValue({});
		fetchService.fetchWithProxy.mockResolvedValue({json} as any);
		await cashuMintApiService.getMintInfo();
		expect(fetchService.fetchWithProxy).toHaveBeenCalledWith('https://mint/v1/info', {
			method: 'GET',
			headers: {'Content-Type': 'application/json'},
		});
	});

	it('builds request url with trailing slash (current double-slash behavior)', async () => {
		configService.get.mockReturnValue('https://mint/');
		const json = jest.fn().mockResolvedValue({});
		fetchService.fetchWithProxy.mockResolvedValue({json} as any);
		await cashuMintApiService.getMintInfo();
		expect(fetchService.fetchWithProxy).toHaveBeenCalledWith('https://mint//v1/info', {
			method: 'GET',
			headers: {'Content-Type': 'application/json'},
		});
	});
});
