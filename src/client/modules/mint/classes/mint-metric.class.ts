import {OrchardMintMetrics, OrchardMintMetricsSnapshot, OrchardMintMetricLabel, MintMetricType} from '@shared/generated.types';

export class MintMetric implements OrchardMintMetrics {
	metric: string;
	labels: OrchardMintMetricLabel[];
	type: MintMetricType;
	date: number;
	value?: number | null;
	min?: number | null;
	max?: number | null;
	count?: number | null;

	constructor(omm: OrchardMintMetrics) {
		this.metric = omm.metric;
		this.labels = omm.labels;
		this.type = omm.type;
		this.date = omm.date;
		this.value = omm.value;
		this.min = omm.min;
		this.max = omm.max;
		this.count = omm.count;
	}
}

export class MintMetricSnapshot implements OrchardMintMetricsSnapshot {
	metric: string;
	labels: OrchardMintMetricLabel[];
	type: MintMetricType;
	value?: number | null;
	sum?: number | null;
	count?: number | null;

	constructor(omms: OrchardMintMetricsSnapshot) {
		this.metric = omms.metric;
		this.labels = omms.labels;
		this.type = omms.type;
		this.value = omms.value;
		this.sum = omms.sum;
		this.count = omms.count;
	}
}
