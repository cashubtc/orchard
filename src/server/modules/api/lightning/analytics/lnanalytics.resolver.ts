/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query, Args} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '@server/modules/graphql/scalars/unixtimestamp.scalar';
import {Timezone, TimezoneType} from '@server/modules/graphql/scalars/timezone.scalar';
import {AnalyticsInterval} from '@server/modules/analytics/analytics.enums';
import {OrchardAnalyticsBackfillStatus} from '@server/modules/api/common/analytics-backfill-status.model';
/* Native Dependencies */
import {LightningAnalyticsMetric} from '@server/modules/lightning/analytics/lnanalytics.enums';
/* Local Dependencies */
import {OrchardLightningAnalytics, OrchardLightningAnalyticsMetric} from './lnanalytics.model.js';
import {ApiLightningAnalyticsService} from './lnanalytics.service.js';

@Resolver()
export class LightningAnalyticsResolver {
	private readonly logger = new Logger(LightningAnalyticsResolver.name);

	constructor(private apiLightningAnalyticsService: ApiLightningAnalyticsService) {}

	/* *******************************************************
		Analytics Queries
	******************************************************** */

	@Query(() => [OrchardLightningAnalytics], {description: 'Get lightning channel local balance analytics'})
	async lightning_analytics_local_balance(
		@Args('date_start', {type: () => UnixTimestamp, nullable: true, description: 'Start of date range filter'}) date_start?: number,
		@Args('date_end', {type: () => UnixTimestamp, nullable: true, description: 'End of date range filter'}) date_end?: number,
		@Args('interval', {type: () => AnalyticsInterval, nullable: true, description: 'Time interval for data aggregation'})
		interval?: AnalyticsInterval,
		@Args('timezone', {type: () => Timezone, nullable: true, description: 'Timezone for date calculations'}) timezone?: TimezoneType,
	): Promise<OrchardLightningAnalytics[]> {
		const tag = 'GET { lightning_analytics_local_balance }';
		this.logger.debug(tag);
		return await this.apiLightningAnalyticsService.getAnalyticsLocalBalance(tag, {date_start, date_end, interval, timezone});
	}

	@Query(() => [OrchardLightningAnalytics], {description: 'Get lightning channel remote balance analytics'})
	async lightning_analytics_remote_balance(
		@Args('date_start', {type: () => UnixTimestamp, nullable: true, description: 'Start of date range filter'}) date_start?: number,
		@Args('date_end', {type: () => UnixTimestamp, nullable: true, description: 'End of date range filter'}) date_end?: number,
		@Args('interval', {type: () => AnalyticsInterval, nullable: true, description: 'Time interval for data aggregation'})
		interval?: AnalyticsInterval,
		@Args('timezone', {type: () => Timezone, nullable: true, description: 'Timezone for date calculations'}) timezone?: TimezoneType,
	): Promise<OrchardLightningAnalytics[]> {
		const tag = 'GET { lightning_analytics_remote_balance }';
		this.logger.debug(tag);
		return await this.apiLightningAnalyticsService.getAnalyticsRemoteBalance(tag, {date_start, date_end, interval, timezone});
	}

	@Query(() => [OrchardLightningAnalyticsMetric], {description: 'Get lightning analytics metrics'})
	async lightning_analytics_metrics(
		@Args('date_start', {type: () => UnixTimestamp, nullable: true, description: 'Start of date range filter'}) date_start?: number,
		@Args('date_end', {type: () => UnixTimestamp, nullable: true, description: 'End of date range filter'}) date_end?: number,
		@Args('interval', {type: () => AnalyticsInterval, nullable: true, description: 'Time interval for data aggregation'})
		interval?: AnalyticsInterval,
		@Args('timezone', {type: () => Timezone, nullable: true, description: 'Timezone for date calculations'}) timezone?: TimezoneType,
		@Args('metrics', {type: () => [LightningAnalyticsMetric], nullable: true, description: 'List of specific metrics to retrieve'})
		metrics?: LightningAnalyticsMetric[],
	): Promise<OrchardLightningAnalyticsMetric[]> {
		const tag = 'GET { lightning_analytics_metrics }';
		this.logger.debug(tag);
		return await this.apiLightningAnalyticsService.getAnalyticsMetrics(tag, {date_start, date_end, interval, timezone, metrics});
	}

	/* *******************************************************
		Backfill Status
	******************************************************** */

	@Query(() => OrchardAnalyticsBackfillStatus, {description: 'Get lightning analytics backfill job status'})
	lightning_analytics_backfill_status(): OrchardAnalyticsBackfillStatus {
		const tag = 'GET { lightning_analytics_backfill_status }';
		this.logger.debug(tag);
		return this.apiLightningAnalyticsService.getBackfillStatus(tag);
	}
}
