/* Core Dependencies */
import {Field, Int, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';
/* Native Dependencies */
import {LightningAnalyticsMetric} from '#server/modules/lightning/analytics/lnanalytics.enums';

@ObjectType({description: 'Lightning analytics data point'})
export class OrchardLightningAnalytics {
	@Field(() => String, {description: 'Unit of measurement for the amount'})
	unit: string;

	@Field(() => String, {description: 'Analytics value for the data point'})
	amount: string;

	@Field(() => UnixTimestamp, {description: 'Timestamp of the data point'})
	date: number;

	@Field(() => Int, {nullable: true, description: 'Number of samples aggregated into this data point'})
	count?: number;

	constructor(unit: string, amount: string, date: number, count?: number) {
		this.unit = unit;
		this.amount = amount;
		this.date = date;
		this.count = count;
	}
}

@ObjectType({description: 'Lightning analytics metric data point'})
export class OrchardLightningAnalyticsMetric {
	@Field(() => String, {description: 'Unit of measurement for the amount'})
	unit: string;

	@Field(() => LightningAnalyticsMetric, {description: 'Type of analytics metric'})
	metric: LightningAnalyticsMetric;

	@Field(() => String, {description: 'Analytics value for the data point'})
	amount: string;

	@Field(() => UnixTimestamp, {description: 'Timestamp of the data point'})
	date: number;

	@Field(() => Int, {nullable: true, description: 'Number of samples aggregated into this data point'})
	count?: number;

	constructor(unit: string, metric: LightningAnalyticsMetric, amount: string, date: number, count?: number) {
		this.unit = unit;
		this.metric = metric;
		this.amount = amount;
		this.date = date;
		this.count = count;
	}
}
