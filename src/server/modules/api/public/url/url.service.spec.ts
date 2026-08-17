/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {FetchService} from '#server/modules/fetch/fetch.service';
/* Local Dependencies */
import {PublicUrlService} from './url.service.js';
import {OrchardPublicUrl} from './url.model.js';

describe('PublicUrlService', () => {
	let publicUrlService: PublicUrlService;
	let fetchService: jest.Mocked<FetchService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [PublicUrlService, {provide: FetchService, useValue: {fetchWithProxy: jest.fn()}}],
		}).compile();

		publicUrlService = module.get<PublicUrlService>(PublicUrlService);
		fetchService = module.get(FetchService);
	});

	it('should be defined', () => {
		expect(publicUrlService).toBeDefined();
	});

	it('returns OrchardPublicUrl[] with has_data=true when JSON parses', async () => {
		const response = {url: 'https://e/x', status: 200, json: async () => ({})} as any;
		fetchService.fetchWithProxy.mockResolvedValue(response);
		const result = await publicUrlService.getUrlsData(['https://e/x']);
		expect(result[0]).toBeInstanceOf(OrchardPublicUrl);
		expect(result[0].has_data).toBe(true);
		expect(result[0].status).toBe(200);
	});

	it('handles network errors and returns defaults', async () => {
		fetchService.fetchWithProxy.mockRejectedValue(new Error('boom'));
		const result = await publicUrlService.getUrlsData(['https://bad/x']);
		expect(result[0]).toBeInstanceOf(OrchardPublicUrl);
		expect(result[0].status).toBe(null);
		expect(result[0].has_data).toBe(false);
	});
});
