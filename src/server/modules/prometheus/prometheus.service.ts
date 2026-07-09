/* Core Dependencies */
import {Injectable} from '@nestjs/common';
/* Application Dependencies */
import {FetchService} from '@server/modules/fetch/fetch.service';
/* Local Dependencies */
import {parsePrometheusText} from './prometheus.helpers';
import {PromFamily} from './prometheus.types';

@Injectable()
export class PrometheusService {
	constructor(private fetchService: FetchService) {}

	/**
	 * Scrapes a prometheus exporter endpoint and parses the response
	 * @param {string} url - Full URL of the metrics endpoint (e.g. http://host:9090/metrics)
	 * @returns {Promise<PromFamily[]>} Parsed metric families
	 */
	async scrapeMetrics(url: string): Promise<PromFamily[]> {
		const response = await this.fetchService.fetchWithProxy(url, {method: 'GET'});
		if (!response.ok) throw new Error(`Prometheus endpoint returned ${response.status} for ${url}`);
		return parsePrometheusText(await response.text());
	}
}
