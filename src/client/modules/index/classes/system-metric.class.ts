/* Shared Dependencies */
import {OrchardSystemMetrics, SystemMetric} from '@shared/generated.types';

export class SystemMetricSample implements OrchardSystemMetrics {
	metric: SystemMetric;
	date: number;
	value: number;
	min?: number | null;
	max?: number | null;

	constructor(osm: OrchardSystemMetrics) {
		this.metric = osm.metric;
		this.date = osm.date;
		this.value = osm.value;
		this.min = osm.min;
		this.max = osm.max;
	}
}
