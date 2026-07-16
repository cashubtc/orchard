import {OrchardMintMetrics, OrchardMintMetricLabel, MintMetricType} from '@shared/generated.types';

export class MintMetric implements OrchardMintMetrics {
	metric: string;
	labels: OrchardMintMetricLabel[];
	type: MintMetricType;
	date: number;
	value?: number | null;
	min?: number | null;
	max?: number | null;
	count?: number | null;
	p50?: number | null;
	p95?: number | null;
	p99?: number | null;

	constructor(omm: OrchardMintMetrics) {
		this.metric = omm.metric;
		this.labels = omm.labels;
		this.type = omm.type;
		this.date = omm.date;
		this.value = omm.value;
		this.min = omm.min;
		this.max = omm.max;
		this.count = omm.count;
		this.p50 = omm.p50;
		this.p95 = omm.p95;
		this.p99 = omm.p99;
	}
}
