/* Core Dependencies */
import {Field, Float, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';
/* Native Dependencies */
import {SystemMetric} from '#server/modules/system/metrics/sysmetrics.enums';

@ObjectType({description: 'System performance metric'})
export class OrchardSystemMetrics {
	@Field(() => SystemMetric, {description: 'Type of system metric'})
	metric: SystemMetric;

	@Field(() => Float, {description: 'Metric value'})
	value: number;

	@Field(() => Float, {nullable: true, description: 'Minimum observed value in the interval'})
	min: number | null;

	@Field(() => Float, {nullable: true, description: 'Maximum observed value in the interval'})
	max: number | null;

	@Field(() => UnixTimestamp, {description: 'Timestamp of the metric measurement'})
	date: number;

	constructor(metric: SystemMetric, value: number, date: number, min?: number | null, max?: number | null) {
		this.metric = metric;
		this.value = value;
		this.date = date;
		this.min = min ?? null;
		this.max = max ?? null;
	}
}
