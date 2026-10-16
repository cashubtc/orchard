/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {ConfigService} from '@nestjs/config';
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

	const response = (status: number, headers: Record<string, string>) =>
		({
			ok: status >= 200 && status < 300,
			status,
			headers: {get: (key: string) => headers[key] ?? null},
			arrayBuffer: async () => new TextEncoder().encode('data').buffer,
		}) as any;
	const fetched = () => fetchService.fetchWithProxy.mock.calls.map(([url]) => url);

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				PublicImageService,
				{
					provide: ConfigService,
					useValue: {get: jest.fn((key: string) => (key === 'server.proxy' ? 'socks://127.0.0.1:9050' : undefined))},
				},
				{provide: FetchService, useValue: {fetchWithProxy: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn().mockReturnValue({code: OrchardErrorCode.PublicAssetError})}},
			],
		}).compile();

		publicImageService = module.get<PublicImageService>(PublicImageService);
		fetchService = module.get(FetchService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(publicImageService).toBeDefined();
	});

	it('returns the image as a data URI, fetched within time and size limits', async () => {
		fetchService.fetchWithProxy.mockResolvedValue(response(200, {'content-type': 'image/png'}));
		const result = await publicImageService.getImageData('TAG', 'https://example.com/i.png');
		expect(result).toBeInstanceOf(OrchardPublicImage);
		expect(result.type).toBe('image/png');
		expect(result.data?.startsWith('data:image/png;base64,')).toBe(true);
		expect(fetchService.fetchWithProxy).toHaveBeenCalledWith(
			'https://example.com/i.png',
			expect.objectContaining({redirect: 'manual', signal: expect.any(AbortSignal), size: 1024 * 1024}),
		);
	});

	it('shares an image for 10 minutes', async () => {
		const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
		fetchService.fetchWithProxy.mockResolvedValue(response(200, {'content-type': 'image/png'}));
		await publicImageService.getImageData('TAG', 'https://example.com/i.png');
		await publicImageService.getImageData('TAG', 'https://example.com/i.png');
		expect(fetched()).toHaveLength(1);
		now.mockReturnValue(1_600_001);
		await publicImageService.getImageData('TAG', 'https://example.com/i.png');
		expect(fetched()).toHaveLength(2);
		now.mockRestore();
	});

	it('follows a redirect to a public address, refusing one to a local address before fetching it', async () => {
		fetchService.fetchWithProxy
			.mockResolvedValueOnce(response(302, {location: '/cdn/i.png'}))
			.mockResolvedValueOnce(response(200, {'content-type': 'image/png'}));
		await publicImageService.getImageData('TAG', 'https://example.com/i.png');
		expect(fetched()).toEqual(['https://example.com/i.png', 'https://example.com/cdn/i.png']);

		fetchService.fetchWithProxy.mockResolvedValueOnce(response(302, {location: 'http://192.168.1.5/i.png'}));
		await expect(publicImageService.getImageData('TAG', 'https://example.org/i.png')).rejects.toBeInstanceOf(OrchardApiError);
		expect(fetched()).not.toContain('http://192.168.1.5/i.png');
	});

	it.each([
		['a local address', 'http://nutshell:3338/icon.png', null, 'local address'],
		['anything but an image', 'https://example.com/page', response(200, {'content-type': 'text/html'}), 'not an image'],
		['an HTTP error', 'https://example.com/gone.png', response(404, {}), 'HTTP 404'],
	])('refuses %s', async (_label, url, reply, message) => {
		if (reply) fetchService.fetchWithProxy.mockResolvedValue(reply);
		await expect(publicImageService.getImageData('TAG', url)).rejects.toBeInstanceOf(OrchardApiError);
		expect(errorService.resolveError).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({message: expect.stringContaining(message)}),
			'TAG',
			expect.anything(),
		);
		if (!reply) expect(fetchService.fetchWithProxy).not.toHaveBeenCalled();
	});
});
