/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
/* Application Dependencies */
import {FetchService} from '#server/modules/fetch/fetch.service';
import {assertPublicDestination} from '#server/modules/fetch/network-guard';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {OrchardPublicImage} from './image.model.js';

const IMAGE_TIMEOUT_MS = 10_000;
const IMAGE_MAX_BYTES = 1024 * 1024;
const IMAGE_CACHE_MS = 10 * 60_000;
const IMAGE_REDIRECTS_MAX = 3;

type FetchedImage = {data: Buffer; type: string};

@Injectable()
export class PublicImageService {
	private readonly logger = new Logger(PublicImageService.name);
	private images = new Map<string, {value: Promise<FetchedImage>; expires_at: number}>();

	constructor(
		private configService: ConfigService,
		private fetchService: FetchService,
		private errorService: ErrorService,
	) {}

	async getImageData(tag: string, url: string): Promise<OrchardPublicImage> {
		try {
			const {data, type} = await this.getImage(url);
			return new OrchardPublicImage(data, type);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.PublicAssetError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	/** An image shared for IMAGE_CACHE_MS; a failed fetch is dropped so the next caller retries, and expired images are dropped as new ones are stored */
	private getImage(url: string): Promise<FetchedImage> {
		const now = Date.now();
		const cached = this.images.get(url);
		if (cached && cached.expires_at > now) return cached.value;
		for (const [stale_url, image] of this.images) if (image.expires_at <= now) this.images.delete(stale_url);
		const value = this.fetchImage(url).catch((error) => {
			this.images.delete(url);
			throw error;
		});
		this.images.set(url, {value, expires_at: now + IMAGE_CACHE_MS});
		return value;
	}

	/** Fetch an image from a public address, checking each redirect hop, within the time and size limits */
	private async fetchImage(url: string): Promise<FetchedImage> {
		const via_tor = !!this.configService.get<string>('server.proxy');
		let target = url;
		for (let hops = 0; ; hops++) {
			if (!(await assertPublicDestination(target, via_tor)))
				throw new Error(`Could not resolve image host ${new URL(target).hostname}`);
			const response = await this.fetchService.fetchWithProxy(target, {
				redirect: 'manual',
				signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
				size: IMAGE_MAX_BYTES,
			});
			const location = response.status >= 300 && response.status < 400 ? response.headers.get('location') : null;
			if (location && hops < IMAGE_REDIRECTS_MAX) {
				target = new URL(location, target).href;
				continue;
			}
			if (!response.ok) throw new Error(`${target}: HTTP ${response.status}`);
			const type = response.headers.get('content-type') ?? '';
			if (!type.startsWith('image/')) throw new Error(`${target} is not an image (${type || 'no content type'})`);
			return {data: Buffer.from(await response.arrayBuffer()), type};
		}
	}
}
