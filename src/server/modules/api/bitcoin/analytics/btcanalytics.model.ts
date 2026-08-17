/* Core Dependencies */
import {Field, Int, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';
/* Native Dependencies */
import {BitcoinAnalyticsMetric} from '#server/modules/bitcoin/analytics/btcanalytics.enums';

@ObjectType({description: 'Bitcoin analytics balance data'})
export class OrchardBitcoinAnalytics {
	@Field(() => String, {description: 'Unit of measurement for the balance'})
	unit: string;

	@Field(() => String, {description: 'Balance amount as a string'})
	amount: string;

	@Field(() => UnixTimestamp, {description: 'Timestamp of the analytics data point'})
	date: number;

	@Field(() => Int, {nullable: true, description: 'Number of entries aggregated'})
	count?: number;

	constructor(unit: string, amount: string, date: number, count?: number) {
		this.unit = unit;
		this.amount = amount;
		this.date = date;
		this.count = count;
	}
}

@ObjectType({description: 'Bitcoin analytics metric data'})
export class OrchardBitcoinAnalyticsMetric {
	@Field(() => String, {description: 'Unit of measurement for the metric'})
	unit: string;

	@Field(() => BitcoinAnalyticsMetric, {description: 'Type of analytics metric'})
	metric: BitcoinAnalyticsMetric;

	@Field(() => String, {description: 'Metric amount as a string'})
	amount: string;

	@Field(() => UnixTimestamp, {description: 'Timestamp of the metric data point'})
	date: number;

	@Field(() => Int, {nullable: true, description: 'Number of entries aggregated'})
	count?: number;

	constructor(unit: string, metric: BitcoinAnalyticsMetric, amount: string, date: number, count?: number) {
		this.unit = unit;
		this.metric = metric;
		this.amount = amount;
		this.date = date;
		this.count = count;
	}
}
