/* Local Dependencies */
import {PromFamily, PromFlatSeries, PromMetricType, PromSample} from './prometheus.types';

const TYPE_LINE_REGEX = /^# TYPE (\S+) (\S+)$/;
const SAMPLE_LINE_REGEX = /^(\S+?)(?:\{(.*)\})?\s+(\S+)(?:\s+\S+)?$/;
const VALID_TYPES: PromMetricType[] = ['gauge', 'counter', 'histogram', 'summary', 'untyped'];

/**
 * Parses Prometheus text exposition format into metric families
 * Histogram families collect _sum and _count samples separately; _bucket samples are skipped
 * @param {string} text - Raw response body of a /metrics endpoint
 * @returns {PromFamily[]} Parsed metric families
 */
export function parsePrometheusText(text: string): PromFamily[] {
	const families: PromFamily[] = [];
	let family: PromFamily | null = null;

	for (const raw_line of text.split('\n')) {
		const line = raw_line.trim();
		if (!line) continue;

		if (line.startsWith('#')) {
			const type_match = line.match(TYPE_LINE_REGEX);
			if (!type_match) continue;
			const type = (VALID_TYPES.includes(type_match[2] as PromMetricType) ? type_match[2] : 'untyped') as PromMetricType;
			family = {name: type_match[1], type, samples: []};
			if (type === 'histogram') {
				family.sum_samples = [];
				family.count_samples = [];
			}
			families.push(family);
			continue;
		}

		const sample_match = line.match(SAMPLE_LINE_REGEX);
		if (!sample_match || !family) continue;

		const [, sample_name, label_block, value_text] = sample_match;
		const value = Number(value_text);
		if (!Number.isFinite(value)) continue;
		if (sample_name !== family.name && !sample_name.startsWith(`${family.name}_`)) continue;

		const sample: PromSample = {labels: parseLabelBlock(label_block), value};

		if (family.type === 'histogram') {
			if (sample_name === `${family.name}_sum`) family.sum_samples?.push(sample);
			if (sample_name === `${family.name}_count`) family.count_samples?.push(sample);
			continue;
		}
		if (sample_name === family.name) family.samples.push(sample);
	}

	return families;
}

/**
 * Parses the label block of a sample line (content between braces)
 * Handles quoted values with \" \\ and \n escapes
 * @param {string | undefined} label_block - Raw label block, e.g. operation="get_settings",status="success"
 * @returns {Record<string, string>} Label name to value map
 */
function parseLabelBlock(label_block: string | undefined): Record<string, string> {
	const labels: Record<string, string> = {};
	if (!label_block) return labels;

	const label_regex = /(\w+)="((?:\\.|[^"\\])*)"/g;
	let match: RegExpExecArray | null;
	while ((match = label_regex.exec(label_block)) !== null) {
		labels[match[1]] = match[2].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
	}
	return labels;
}

/**
 * Builds a canonical stable string identity for a label set
 * @param {Record<string, string>} labels - Label name to value map
 * @returns {string} Sorted key=value pairs joined by commas, empty string when unlabeled
 */
export function canonicalizeLabels(labels: Record<string, string>): string {
	return Object.keys(labels)
		.sort()
		.map((key) => `${key}=${labels[key]}`)
		.join(',');
}

/**
 * Flattens a metric family into per-label-set series with canonicalized labels
 * Gauge/counter families yield one series per sample; histogram families zip _sum and _count per label set
 * @param {PromFamily} family - Parsed metric family
 * @returns {PromFlatSeries[]} One entry per label set
 */
export function flattenFamily(family: PromFamily): PromFlatSeries[] {
	if (family.type === 'histogram') {
		const counts = new Map<string, number>();
		for (const sample of family.count_samples ?? []) {
			counts.set(canonicalizeLabels(sample.labels), sample.value);
		}
		return (family.sum_samples ?? []).map((sample) => {
			const labels = canonicalizeLabels(sample.labels);
			return {name: family.name, labels, type: family.type, value: null, sum: sample.value, count: counts.get(labels) ?? 0};
		});
	}
	return family.samples.map((sample) => ({
		name: family.name,
		labels: canonicalizeLabels(sample.labels),
		type: family.type,
		value: sample.value,
		sum: null,
		count: null,
	}));
}

/**
 * Parses a canonical label string back into name/value pairs
 * @param {string} canonical - Canonical string produced by canonicalizeLabels
 * @returns {{name: string; value: string}[]} Label pairs, empty array for the empty string
 */
export function parseCanonicalLabels(canonical: string): {name: string; value: string}[] {
	if (!canonical) return [];
	return canonical.split(',').map((pair) => {
		const separator_index = pair.indexOf('=');
		return {name: pair.slice(0, separator_index), value: pair.slice(separator_index + 1)};
	});
}
