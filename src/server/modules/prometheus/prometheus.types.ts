export type PromMetricType = 'gauge' | 'counter' | 'histogram' | 'summary' | 'untyped';

export type PromSample = {
	labels: Record<string, string>;
	value: number;
};

export type PromFamily = {
	name: string;
	type: PromMetricType;
	samples: PromSample[];
	sum_samples?: PromSample[];
	count_samples?: PromSample[];
};
