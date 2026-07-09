/* Core Dependencies */
import {Field, Float, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '@server/modules/graphql/scalars/unixtimestamp.scalar';
import {parseCanonicalLabels} from '@server/modules/prometheus/prometheus.helpers';
/* Native Dependencies */
import {MintMetricType} from '@server/modules/cashu/mintmetrics/mintmetrics.enums';

@ObjectType({description: 'Mint server metric label'})
export class OrchardMintMetricLabel {
	@Field({description: 'Label name'})
	name: string;

	@Field({description: 'Label value'})
	value: string;
}

@ObjectType({description: 'Aggregated mint server metric data point'})
export class OrchardMintMetrics {
	@Field({description: 'Prometheus metric family name'})
	metric: string;

	@Field(() => [OrchardMintMetricLabel], {description: 'Labels identifying the series'})
	labels: OrchardMintMetricLabel[];

	@Field(() => MintMetricType, {description: 'Type of metric'})
	type: MintMetricType;

	@Field(() => UnixTimestamp, {description: 'Start of the aggregation interval'})
	date: number;

	@Field(() => Float, {nullable: true, description: 'Gauge average, counter delta, or histogram average duration in the interval'})
	value: number | null;

	@Field(() => Float, {nullable: true, description: 'Minimum observed gauge value in the interval'})
	min: number | null;

	@Field(() => Float, {nullable: true, description: 'Maximum observed gauge value in the interval'})
	max: number | null;

	@Field(() => Float, {nullable: true, description: 'Histogram observation count in the interval'})
	count: number | null;

	@Field(() => Float, {nullable: true, description: 'Histogram median (50th percentile) in the interval'})
	p50: number | null;

	@Field(() => Float, {nullable: true, description: 'Histogram 95th percentile in the interval'})
	p95: number | null;

	@Field(() => Float, {nullable: true, description: 'Histogram 99th percentile in the interval'})
	p99: number | null;

	constructor(
		metric: string,
		labels: string,
		type: MintMetricType,
		date: number,
		value: number | null,
		options?: {
			min?: number | null;
			max?: number | null;
			count?: number | null;
			p50?: number | null;
			p95?: number | null;
			p99?: number | null;
		},
	) {
		this.metric = metric;
		this.labels = parseCanonicalLabels(labels);
		this.type = type;
		this.date = date;
		this.value = value;
		this.min = options?.min ?? null;
		this.max = options?.max ?? null;
		this.count = options?.count ?? null;
		this.p50 = options?.p50 ?? null;
		this.p95 = options?.p95 ?? null;
		this.p99 = options?.p99 ?? null;
	}
}

@ObjectType({description: 'Live mint server metric sample'})
export class OrchardMintMetricsSnapshot {
	@Field({description: 'Prometheus metric family name'})
	metric: string;

	@Field(() => [OrchardMintMetricLabel], {description: 'Labels identifying the series'})
	labels: OrchardMintMetricLabel[];

	@Field(() => MintMetricType, {description: 'Type of metric'})
	type: MintMetricType;

	@Field(() => Float, {nullable: true, description: 'Current gauge value or cumulative counter value'})
	value: number | null;

	@Field(() => Float, {nullable: true, description: 'Histogram cumulative sum of observations'})
	sum: number | null;

	@Field(() => Float, {nullable: true, description: 'Histogram cumulative observation count'})
	count: number | null;

	constructor(metric: string, labels: string, type: MintMetricType, value: number | null, sum: number | null, count: number | null) {
		this.metric = metric;
		this.labels = parseCanonicalLabels(labels);
		this.type = type;
		this.value = value;
		this.sum = sum;
		this.count = count;
	}
}
