/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query, Args} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '@server/modules/graphql/scalars/unixtimestamp.scalar';
import {Timezone, TimezoneType} from '@server/modules/graphql/scalars/timezone.scalar';
import {AnalyticsInterval} from '@server/modules/analytics/analytics.enums';
import {MintUnit} from '@server/modules/cashu/cashu.enums';
import {MintAnalyticsMetric} from '@server/modules/cashu/mintanalytics/mintanalytics.enums';
import {OrchardAnalyticsBackfillStatus} from '@server/modules/api/common/analytics-backfill-status.model';
/* Local Dependencies */
import {OrchardMintAnalytics, OrchardMintAnalyticsMetric, OrchardMintKeysetsAnalytics} from './mintanalytics.model.js';
import {MintAnalyticsService} from './mintanalytics.service.js';

@Resolver()
export class MintAnalyticsResolver {
	private readonly logger = new Logger(MintAnalyticsResolver.name);

	constructor(private mintAnalyticsService: MintAnalyticsService) {}

	@Query(() => [OrchardMintAnalytics], {description: 'Get mint balance analytics over time'})
	async mint_analytics_balances(
		@Args('units', {type: () => [MintUnit], nullable: true, description: 'Currency units to filter by'}) units?: MintUnit[],
		@Args('date_start', {type: () => UnixTimestamp, nullable: true, description: 'Start of date range filter'})
		date_start?: number,
		@Args('date_end', {type: () => UnixTimestamp, nullable: true, description: 'End of date range filter'}) date_end?: number,
		@Args('interval', {type: () => AnalyticsInterval, nullable: true, description: 'Time interval for data aggregation'})
		interval?: AnalyticsInterval,
		@Args('timezone', {type: () => Timezone, nullable: true, description: 'Timezone for date calculations'}) timezone?: TimezoneType,
	): Promise<OrchardMintAnalytics[]> {
		const tag = 'GET { mint_analytics_balances }';
		this.logger.debug(tag);
		return await this.mintAnalyticsService.getMintAnalyticsBalances(tag, {units, date_start, date_end, interval, timezone});
	}

	@Query(() => [OrchardMintAnalytics], {description: 'Get mint operation analytics over time'})
	async mint_analytics_mints(
		@Args('units', {type: () => [MintUnit], nullable: true, description: 'Currency units to filter by'}) units?: MintUnit[],
		@Args('date_start', {type: () => UnixTimestamp, nullable: true, description: 'Start of date range filter'})
		date_start?: number,
		@Args('date_end', {type: () => UnixTimestamp, nullable: true, description: 'End of date range filter'}) date_end?: number,
		@Args('interval', {type: () => AnalyticsInterval, nullable: true, description: 'Time interval for data aggregation'})
		interval?: AnalyticsInterval,
		@Args('timezone', {type: () => Timezone, nullable: true, description: 'Timezone for date calculations'}) timezone?: TimezoneType,
	): Promise<OrchardMintAnalytics[]> {
		const tag = 'GET { mint_analytics_mints }';
		this.logger.debug(tag);
		return await this.mintAnalyticsService.getMintAnalyticsMints(tag, {units, date_start, date_end, interval, timezone});
	}

	@Query(() => [OrchardMintAnalytics], {description: 'Get melt operation analytics over time'})
	async mint_analytics_melts(
		@Args('units', {type: () => [MintUnit], nullable: true, description: 'Currency units to filter by'}) units?: MintUnit[],
		@Args('date_start', {type: () => UnixTimestamp, nullable: true, description: 'Start of date range filter'})
		date_start?: number,
		@Args('date_end', {type: () => UnixTimestamp, nullable: true, description: 'End of date range filter'}) date_end?: number,
		@Args('interval', {type: () => AnalyticsInterval, nullable: true, description: 'Time interval for data aggregation'})
		interval?: AnalyticsInterval,
		@Args('timezone', {type: () => Timezone, nullable: true, description: 'Timezone for date calculations'}) timezone?: TimezoneType,
	): Promise<OrchardMintAnalytics[]> {
		const tag = 'GET { mint_analytics_melts }';
		this.logger.debug(tag);
		return await this.mintAnalyticsService.getMintAnalyticsMelts(tag, {units, date_start, date_end, interval, timezone});
	}

	@Query(() => [OrchardMintAnalytics], {description: 'Get swap operation analytics over time'})
	async mint_analytics_swaps(
		@Args('units', {type: () => [MintUnit], nullable: true, description: 'Currency units to filter by'}) units?: MintUnit[],
		@Args('date_start', {type: () => UnixTimestamp, nullable: true, description: 'Start of date range filter'})
		date_start?: number,
		@Args('date_end', {type: () => UnixTimestamp, nullable: true, description: 'End of date range filter'}) date_end?: number,
		@Args('interval', {type: () => AnalyticsInterval, nullable: true, description: 'Time interval for data aggregation'})
		interval?: AnalyticsInterval,
		@Args('timezone', {type: () => Timezone, nullable: true, description: 'Timezone for date calculations'}) timezone?: TimezoneType,
	): Promise<OrchardMintAnalytics[]> {
		const tag = 'GET { mint_analytics_swaps }';
		this.logger.debug(tag);
		return await this.mintAnalyticsService.getMintAnalyticsSwaps(tag, {units, date_start, date_end, interval, timezone});
	}

	@Query(() => [OrchardMintAnalytics], {description: 'Get fee analytics over time'})
	async mint_analytics_fees(
		@Args('units', {type: () => [MintUnit], nullable: true, description: 'Currency units to filter by'}) units?: MintUnit[],
		@Args('date_start', {type: () => UnixTimestamp, nullable: true, description: 'Start of date range filter'})
		date_start?: number,
		@Args('date_end', {type: () => UnixTimestamp, nullable: true, description: 'End of date range filter'}) date_end?: number,
		@Args('interval', {type: () => AnalyticsInterval, nullable: true, description: 'Time interval for data aggregation'})
		interval?: AnalyticsInterval,
		@Args('timezone', {type: () => Timezone, nullable: true, description: 'Timezone for date calculations'}) timezone?: TimezoneType,
	): Promise<OrchardMintAnalytics[]> {
		const tag = 'GET { mint_analytics_fees }';
		this.logger.debug(tag);
		return await this.mintAnalyticsService.getMintAnalyticsFees(tag, {units, date_start, date_end, interval, timezone});
	}

	@Query(() => [OrchardMintAnalytics], {description: 'Get proof analytics over time'})
	async mint_analytics_proofs(
		@Args('units', {type: () => [MintUnit], nullable: true, description: 'Currency units to filter by'}) units?: MintUnit[],
		@Args('date_start', {type: () => UnixTimestamp, nullable: true, description: 'Start of date range filter'})
		date_start?: number,
		@Args('date_end', {type: () => UnixTimestamp, nullable: true, description: 'End of date range filter'}) date_end?: number,
		@Args('interval', {type: () => AnalyticsInterval, nullable: true, description: 'Time interval for data aggregation'})
		interval?: AnalyticsInterval,
		@Args('timezone', {type: () => Timezone, nullable: true, description: 'Timezone for date calculations'}) timezone?: TimezoneType,
	): Promise<OrchardMintAnalytics[]> {
		const tag = 'GET { mint_analytics_proofs }';
		this.logger.debug(tag);
		return await this.mintAnalyticsService.getMintAnalyticsProofs(tag, {units, date_start, date_end, interval, timezone});
	}

	@Query(() => [OrchardMintAnalytics], {description: 'Get promise analytics over time'})
	async mint_analytics_promises(
		@Args('units', {type: () => [MintUnit], nullable: true, description: 'Currency units to filter by'}) units?: MintUnit[],
		@Args('date_start', {type: () => UnixTimestamp, nullable: true, description: 'Start of date range filter'})
		date_start?: number,
		@Args('date_end', {type: () => UnixTimestamp, nullable: true, description: 'End of date range filter'}) date_end?: number,
		@Args('interval', {type: () => AnalyticsInterval, nullable: true, description: 'Time interval for data aggregation'})
		interval?: AnalyticsInterval,
		@Args('timezone', {type: () => Timezone, nullable: true, description: 'Timezone for date calculations'}) timezone?: TimezoneType,
	): Promise<OrchardMintAnalytics[]> {
		const tag = 'GET { mint_analytics_promises }';
		this.logger.debug(tag);
		return await this.mintAnalyticsService.getMintAnalyticsPromises(tag, {units, date_start, date_end, interval, timezone});
	}

	@Query(() => [OrchardMintAnalyticsMetric], {description: 'Get mint analytics for specified metrics'})
	async mint_analytics_metrics(
		@Args('units', {type: () => [MintUnit], nullable: true, description: 'Currency units to filter by'}) units?: MintUnit[],
		@Args('date_start', {type: () => UnixTimestamp, nullable: true, description: 'Start of date range filter'})
		date_start?: number,
		@Args('date_end', {type: () => UnixTimestamp, nullable: true, description: 'End of date range filter'}) date_end?: number,
		@Args('interval', {type: () => AnalyticsInterval, nullable: true, description: 'Time interval for data aggregation'})
		interval?: AnalyticsInterval,
		@Args('timezone', {type: () => Timezone, nullable: true, description: 'Timezone for date calculations'}) timezone?: TimezoneType,
		@Args('metrics', {type: () => [MintAnalyticsMetric], nullable: true, description: 'Specific metrics to retrieve'})
		metrics?: MintAnalyticsMetric[],
	): Promise<OrchardMintAnalyticsMetric[]> {
		const tag = 'GET { mint_analytics_metrics }';
		this.logger.debug(tag);
		return await this.mintAnalyticsService.getAnalyticsMetrics(tag, {units, date_start, date_end, interval, timezone, metrics});
	}

	@Query(() => [OrchardMintKeysetsAnalytics], {description: 'Get analytics grouped by keyset'})
	async mint_analytics_keysets(
		@Args('date_start', {type: () => UnixTimestamp, nullable: true, description: 'Start of date range filter'})
		date_start?: number,
		@Args('date_end', {type: () => UnixTimestamp, nullable: true, description: 'End of date range filter'}) date_end?: number,
		@Args('interval', {type: () => AnalyticsInterval, nullable: true, description: 'Time interval for data aggregation'})
		interval?: AnalyticsInterval,
		@Args('timezone', {type: () => Timezone, nullable: true, description: 'Timezone for date calculations'}) timezone?: TimezoneType,
	): Promise<OrchardMintKeysetsAnalytics[]> {
		const tag = 'GET { mint_analytics_keysets }';
		this.logger.debug(tag);
		return await this.mintAnalyticsService.getMintAnalyticsKeysets(tag, {date_start, date_end, interval, timezone});
	}

	@Query(() => OrchardAnalyticsBackfillStatus, {description: 'Get analytics backfill job status'})
	mint_analytics_backfill_status(): OrchardAnalyticsBackfillStatus {
		const tag = 'GET { mint_analytics_backfill_status }';
		this.logger.debug(tag);
		return this.mintAnalyticsService.getBackfillStatus(tag);
	}
}
