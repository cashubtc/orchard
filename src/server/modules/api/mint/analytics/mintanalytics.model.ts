/* Core Dependencies */
import {Field, Int, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {MintUnit} from '#server/modules/cashu/cashu.enums';
import {MintAnalyticsMetric} from '#server/modules/cashu/mintanalytics/mintanalytics.enums';
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';

@ObjectType({description: 'Cashu mint analytics data point'})
export class OrchardMintAnalytics {
	@Field(() => MintUnit, {description: 'Currency unit'})
	unit: string;

	@Field(() => String, {description: 'Aggregated amount as string'})
	amount: string;

	@Field(() => UnixTimestamp, {description: 'Timestamp of the data point'})
	date: number;

	@Field(() => Int, {nullable: true, description: 'Operation count for the period'})
	count?: number;

	constructor(unit: string, amount: string, date: number, count?: number) {
		this.unit = unit;
		this.amount = amount;
		this.date = date;
		this.count = count;
	}
}

@ObjectType({description: 'Cashu mint keyset-level analytics data point'})
export class OrchardMintKeysetsAnalytics {
	@Field(() => String, {description: 'Keyset ID'})
	keyset_id: string;

	@Field(() => String, {description: 'Aggregated amount as string'})
	amount: string;

	@Field(() => UnixTimestamp, {description: 'Timestamp of the data point'})
	date: number;

	constructor(keyset_id: string, amount: string, date: number) {
		this.keyset_id = keyset_id;
		this.amount = amount;
		this.date = date;
	}
}

@ObjectType({description: 'Cashu mint analytics metric data point'})
export class OrchardMintAnalyticsMetric {
	@Field(() => MintUnit, {description: 'Currency unit'})
	unit: string;

	@Field(() => MintAnalyticsMetric, {description: 'Type of analytics metric'})
	metric: MintAnalyticsMetric;

	@Field(() => String, {description: 'Aggregated amount as string'})
	amount: string;

	@Field(() => UnixTimestamp, {description: 'Timestamp of the data point'})
	date: number;

	@Field(() => Int, {nullable: true, description: 'Operation count for the period'})
	count?: number;

	constructor(unit: string, metric: MintAnalyticsMetric, amount: string, date: number, count?: number) {
		this.unit = unit;
		this.metric = metric;
		this.amount = amount;
		this.date = date;
		this.count = count;
	}
}
