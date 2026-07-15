/* Core Dependencies */
import {Injectable} from '@nestjs/common';
/* Application Dependencies */
import {FetchService} from '@server/modules/fetch/fetch.service';
/* Local Dependencies */
import {parsePrometheusText} from './prometheus.helpers';
import {PromFamily} from './prometheus.types';

// Bounds a scrape so a hung endpoint (accepts the connection but never responds, e.g. a stalled Tor hop) can't leave a fetch pending forever
const SCRAPE_TIMEOUT_MS = 15_000;

@Injectable()
export class PrometheusService {
	constructor(private fetchService: FetchService) {}

	/**
	 * Scrapes a prometheus exporter endpoint and parses the response.
	 * Aborts (and rejects) if the endpoint does not respond within SCRAPE_TIMEOUT_MS.
	 * @param {string} url - Full URL of the metrics endpoint (e.g. http://host:9090/metrics)
	 * @returns {Promise<PromFamily[]>} Parsed metric families
	 */
	async scrapeMetrics(url: string): Promise<PromFamily[]> {
		const response = await this.fetchService.fetchWithProxy(url, {method: 'GET', signal: AbortSignal.timeout(SCRAPE_TIMEOUT_MS)});
		if (!response.ok) throw new Error(`Prometheus endpoint returned ${response.status} for ${url}`);
		return parsePrometheusText(await response.text());
	}
}
