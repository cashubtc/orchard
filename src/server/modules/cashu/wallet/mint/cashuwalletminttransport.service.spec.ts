/* Core Dependencies */
import {promises as dns} from 'dns';
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {ConfigService} from '@nestjs/config';
/* Vendor Dependencies */
import {HttpResponseError, MintOperationError, NetworkError, RateLimitError} from '@cashu/cashu-ts';
/* Application Dependencies */
import {FetchService} from '#server/modules/fetch/fetch.service';
/* Local Dependencies */
import {CashuWalletMintTransportService} from './cashuwalletminttransport.service.js';

describe('CashuWalletMintTransportService', () => {
	let service: CashuWalletMintTransportService;

	const response = (body: any, status = 200, headers: Record<string, string> = {}) => ({
		ok: status >= 200 && status < 300,
		status,
		text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
		headers: {get: (name: string) => headers[name] ?? null},
	});
	const fetch_service = {fetchWithProxy: jest.fn()};
	const config_service = {get: jest.fn()};

	beforeEach(async () => {
		jest.clearAllMocks();
		config_service.get.mockReset();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CashuWalletMintTransportService,
				{provide: ConfigService, useValue: config_service},
				{provide: FetchService, useValue: fetch_service},
			],
		}).compile();

		service = module.get<CashuWalletMintTransportService>(CashuWalletMintTransportService);
	});

	it('aborts a mint that never answers once the request timeout passes', async () => {
		const aborted = () => Object.assign(new Error('The operation was aborted.'), {name: 'AbortError'});
		fetch_service.fetchWithProxy.mockImplementation(
			(_url: string, {signal}: any) => new Promise((_, reject) => signal.addEventListener('abort', () => reject(aborted()))),
		);
		await expect(service.request({endpoint: 'https://203.0.113.12/v1/info', requestTimeout: 20})).rejects.toThrow(
			'https://203.0.113.12/v1/info: timed out after 20ms',
		);
	});

	it.each([
		['a NUT error', response({code: 20003, detail: 'Minting is disabled'}, 400), MintOperationError],
		['rate limiting', response('', 429, {'Retry-After': '5'}), RateLimitError],
		['any other HTTP error', response('', 502), HttpResponseError],
	])('keeps the cashu-ts error contract for %s', async (_label, reply, type) => {
		fetch_service.fetchWithProxy.mockResolvedValue(reply);
		await expect(service.request({endpoint: 'https://203.0.113.12/v1/info'})).rejects.toBeInstanceOf(type);
	});

	it('refuses an onion mint on the guarded transport without the Tor proxy, sending nothing', async () => {
		await expect(service.guardedRequest(true)({endpoint: 'http://abcdefghijklmnop.onion/v1/info'})).rejects.toBeInstanceOf(
			NetworkError,
		);
		expect(fetch_service.fetchWithProxy).not.toHaveBeenCalled();
	});

	it('re-checks the address on every request, reaching a local mint only when local addresses are allowed', async () => {
		fetch_service.fetchWithProxy.mockResolvedValue(response({name: 'LAN Mint'}));
		const endpoint = 'http://192.168.1.20:3338/v1/info';
		await expect(service.guardedRequest(false)({endpoint})).rejects.toThrow(
			`${endpoint}: Blocked: IP '192.168.1.20' is in a private/reserved range; only an admin can add mints on local addresses`,
		);
		expect(fetch_service.fetchWithProxy).not.toHaveBeenCalled();
		await expect(service.guardedRequest(true)({endpoint})).resolves.toEqual({name: 'LAN Mint'});
	});

	it('resolves no mint host outside Tor, still refusing a local mint', async () => {
		config_service.get.mockReturnValue('socks://127.0.0.1:9050');
		const resolve = jest.spyOn(dns, 'resolve4');
		fetch_service.fetchWithProxy.mockResolvedValue(response({name: 'Cedar Mint'}));
		await expect(service.guardedRequest(false)({endpoint: 'https://mint.cedar.example/v1/info'})).resolves.toEqual({
			name: 'Cedar Mint',
		});
		await expect(service.guardedRequest(false)({endpoint: 'http://nutshell:3338/v1/info'})).rejects.toThrow('local address');
		expect(resolve).not.toHaveBeenCalled();
		resolve.mockRestore();
	});

	it('refuses to follow a redirect, saying where it points', async () => {
		fetch_service.fetchWithProxy.mockResolvedValue(response('', 301, {location: '/v2/info'}));
		await expect(service.request({endpoint: 'http://203.0.113.12/v1/info'})).rejects.toMatchObject({
			message: 'http://203.0.113.12/v1/info: redirects to http://203.0.113.12/v2/info',
			location: 'http://203.0.113.12/v2/info',
		});
	});
});
