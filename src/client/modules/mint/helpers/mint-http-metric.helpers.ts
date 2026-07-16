/* Native Dependencies */
import {MintMetric} from '@client/modules/mint/classes/mint-metric.class';

/**
 * Reads a label value from a metric's label set
 * @param {MintMetric} metric - Metric point
 * @param {string} name - Label name
 * @returns {string | undefined} Label value if present
 */
function getLabelValue(metric: MintMetric, name: string): string | undefined {
	return metric.labels.find((label) => label.name === name)?.value;
}

/**
 * Computes the HTTP error rate (percent of 4xx/5xx responses) over the window from request counter deltas.
 * Only status codes >= 400 count as errors; 1xx (e.g. websocket 101 upgrades), 2xx and 3xx are treated as success.
 * @param {MintMetric[]} metrics - Aggregated cdk_http_requests_total series (per endpoint/status)
 * @returns {number | null} Error rate percentage, or null when there were no requests
 */
export function computeHttpErrorRate(metrics: MintMetric[]): number | null {
	let total = 0;
	let errors = 0;
	for (const metric of metrics) {
		const count = metric.value ?? 0;
		total += count;
		const status = Number(getLabelValue(metric, 'status'));
		if (Number.isFinite(status) && status >= 400) errors += count;
	}
	if (total <= 0) return null;
	return (errors / total) * 100;
}

/**
 * Aggregates total HTTP requests per endpoint over the window, descending, for the distribution chart
 * @param {MintMetric[]} metrics - Aggregated cdk_http_requests_total series
 * @returns {{label: string; value: number}[]} Per-endpoint totals, highest first
 */
export function computeEndpointDistribution(metrics: MintMetric[]): {label: string; value: number}[] {
	const totals = new Map<string, number>();
	for (const metric of metrics) {
		const endpoint = getLabelValue(metric, 'endpoint') ?? 'unknown';
		totals.set(endpoint, (totals.get(endpoint) ?? 0) + (metric.value ?? 0));
	}
	return Array.from(totals.entries())
		.map(([label, value]) => ({label, value}))
		.filter((slice) => slice.value > 0)
		.sort((a, b) => b.value - a.value);
}
