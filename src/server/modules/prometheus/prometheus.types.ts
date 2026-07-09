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

export type PromFlatSeries = {
	name: string;
	labels: string;
	type: PromMetricType;
	value: number | null;
	sum: number | null;
	count: number | null;
};
