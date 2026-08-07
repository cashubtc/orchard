/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {FetchService} from '#server/modules/fetch/fetch.service';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {PublicImageService} from './image.service.js';
import {OrchardPublicImage} from './image.model.js';

describe('PublicImageService', () => {
	let publicImageService: PublicImageService;
	let fetchService: jest.Mocked<FetchService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				PublicImageService,
				{provide: FetchService, useValue: {fetchWithProxy: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		publicImageService = module.get<PublicImageService>(PublicImageService);
		fetchService = module.get(FetchService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(publicImageService).toBeDefined();
	});

	it('returns OrchardPublicImage with content type and buffer', async () => {
		const headers = new Map<string, string>();
		headers.set('content-type', 'image/png');
		const response = {
			headers: {get: (k: string) => headers.get(k) || null},
			arrayBuffer: async () => new TextEncoder().encode('data').buffer,
		} as any;
		fetchService.fetchWithProxy.mockResolvedValue(response);
		const result = await publicImageService.getImageData('TAG', 'https://example.com/i.png');
		expect(result).toBeInstanceOf(OrchardPublicImage);
		expect(result.type).toBe('image/png');
		expect(result.data?.startsWith('data:image/png;base64,')).toBe(true);
	});

	it('wraps errors via resolveError and throws OrchardApiError', async () => {
		fetchService.fetchWithProxy.mockRejectedValue(new Error('boom'));
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.PublicAssetError});
		await expect(publicImageService.getImageData('MY_TAG', 'https://ex/i.png')).rejects.toBeInstanceOf(OrchardApiError);
	});
});
