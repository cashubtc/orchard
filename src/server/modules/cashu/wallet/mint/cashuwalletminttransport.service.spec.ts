/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {ConfigService} from '@nestjs/config';
/* Vendor Dependencies */
import {HttpResponseError, MintOperationError, RateLimitError} from '@cashu/cashu-ts';
/* Application Dependencies */
import {FetchService} from '#server/modules/fetch/fetch.service';
/* Local Dependencies */
import {CashuWalletMintTransportService} from './cashuwalletminttransport.service.js';
import {MintAddressError} from '../cashuwallet.helpers.js';

describe('CashuWalletMintTransportService', () => {
	let service: CashuWalletMintTransportService;

	const response = (body: any, status = 200, headers: Record<string, string> = {}) => ({
		ok: status >= 200 && status < 300,
		status,
		text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
		headers: {get: (name: string) => headers[name] ?? null},
	});
	const fetch_service = {fetchWithProxy: jest.fn()};

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CashuWalletMintTransportService,
				{provide: ConfigService, useValue: {get: jest.fn()}},
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

	it('refuses a private address on the guarded transport without sending the request', async () => {
		await expect(service.guarded_request({endpoint: 'https://10.0.0.9/v1/info'})).rejects.toBeInstanceOf(MintAddressError);
		expect(fetch_service.fetchWithProxy).not.toHaveBeenCalled();
	});
});
