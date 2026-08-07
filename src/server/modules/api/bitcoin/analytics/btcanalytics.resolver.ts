/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query, Args} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';
import {Timezone, TimezoneType} from '#server/modules/graphql/scalars/timezone.scalar';
import {AnalyticsInterval} from '#server/modules/analytics/analytics.enums';
import {OrchardAnalyticsBackfillStatus} from '#server/modules/api/common/analytics-backfill-status.model';
/* Native Dependencies */
import {BitcoinAnalyticsMetric} from '#server/modules/bitcoin/analytics/btcanalytics.enums';
/* Local Dependencies */
import {OrchardBitcoinAnalytics, OrchardBitcoinAnalyticsMetric} from './btcanalytics.model.js';
import {ApiBitcoinAnalyticsService} from './btcanalytics.service.js';

@Resolver()
export class BitcoinAnalyticsResolver {
	private readonly logger = new Logger(BitcoinAnalyticsResolver.name);

	constructor(private apiBitcoinAnalyticsService: ApiBitcoinAnalyticsService) {}

	/* *******************************************************
		Analytics Queries
	******************************************************** */

	@Query(() => [OrchardBitcoinAnalytics], {description: 'Get Bitcoin analytics balance data'})
	async bitcoin_analytics_balance(
		@Args('date_start', {type: () => UnixTimestamp, nullable: true, description: 'Start of date range filter'}) date_start?: number,
		@Args('date_end', {type: () => UnixTimestamp, nullable: true, description: 'End of date range filter'}) date_end?: number,
		@Args('interval', {type: () => AnalyticsInterval, nullable: true, description: 'Time interval for data aggregation'})
		interval?: AnalyticsInterval,
		@Args('timezone', {type: () => Timezone, nullable: true, description: 'Timezone for date calculations'}) timezone?: TimezoneType,
	): Promise<OrchardBitcoinAnalytics[]> {
		const tag = 'GET { bitcoin_analytics_balance }';
		this.logger.debug(tag);
		return await this.apiBitcoinAnalyticsService.getAnalyticsBalance(tag, {date_start, date_end, interval, timezone});
	}

	@Query(() => [OrchardBitcoinAnalyticsMetric], {description: 'Get Bitcoin analytics metrics'})
	async bitcoin_analytics_metrics(
		@Args('date_start', {type: () => UnixTimestamp, nullable: true, description: 'Start of date range filter'}) date_start?: number,
		@Args('date_end', {type: () => UnixTimestamp, nullable: true, description: 'End of date range filter'}) date_end?: number,
		@Args('interval', {type: () => AnalyticsInterval, nullable: true, description: 'Time interval for data aggregation'})
		interval?: AnalyticsInterval,
		@Args('timezone', {type: () => Timezone, nullable: true, description: 'Timezone for date calculations'}) timezone?: TimezoneType,
		@Args('metrics', {type: () => [BitcoinAnalyticsMetric], nullable: true, description: 'Specific metrics to retrieve'})
		metrics?: BitcoinAnalyticsMetric[],
	): Promise<OrchardBitcoinAnalyticsMetric[]> {
		const tag = 'GET { bitcoin_analytics_metrics }';
		this.logger.debug(tag);
		return await this.apiBitcoinAnalyticsService.getAnalyticsMetrics(tag, {date_start, date_end, interval, timezone, metrics});
	}

	/* *******************************************************
		Backfill Status
	******************************************************** */

	@Query(() => OrchardAnalyticsBackfillStatus, {description: 'Get Bitcoin analytics backfill status'})
	bitcoin_analytics_backfill_status(): OrchardAnalyticsBackfillStatus {
		const tag = 'GET { bitcoin_analytics_backfill_status }';
		this.logger.debug(tag);
		return this.apiBitcoinAnalyticsService.getBackfillStatus(tag);
	}
}
