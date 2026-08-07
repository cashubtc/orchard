/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {FetchService} from '@server/modules/fetch/fetch.service';
/* Local Dependencies */
import {assertPublicUrl} from '../network-guard.js';
import {OrchardPublicUrl} from './url.model.js';

@Injectable()
export class PublicUrlService {
	private readonly logger = new Logger(PublicUrlService.name);

	private readonly FETCH_TIMEOUT = 15000;

	constructor(private fetchService: FetchService) {}

	public async getUrlsData(urls: string[]): Promise<OrchardPublicUrl[]> {
		const promises = urls.map((url) => this.getUrlData(url));
		return await Promise.all(promises);
	}

	private async getUrlData(url: string): Promise<OrchardPublicUrl> {
		let ip_address: string | null;
		let has_data: boolean = false;

		/* SSRF guard: resolve DNS and reject private/reserved IPs before fetching */
		try {
			ip_address = await assertPublicUrl(url);
		} catch (error) {
			this.logger.warn(`SSRF blocked: ${error instanceof Error ? error.message : error}`);
			return new OrchardPublicUrl(url, null, null, has_data);
		}

		let response: any;
		try {
			response = await this.fetchService.fetchWithProxy(url, {signal: AbortSignal.timeout(this.FETCH_TIMEOUT)});
		} catch {
			return new OrchardPublicUrl(url, null, ip_address, has_data);
		}

		try {
			await response.json();
			has_data = true;
		} catch (error) {
			this.logger.warn('Failed to parse JSON:', error);
		}

		return new OrchardPublicUrl(url, response.status, ip_address, has_data);
	}
}
