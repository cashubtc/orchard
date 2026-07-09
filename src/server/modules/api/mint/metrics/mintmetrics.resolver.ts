/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query, Args} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '@server/modules/graphql/scalars/unixtimestamp.scalar';
import {Timezone, TimezoneType} from '@server/modules/graphql/scalars/timezone.scalar';
/* Native Dependencies */
import {SystemMetricsInterval} from '@server/modules/system/metrics/sysmetrics.enums';
/* Local Dependencies */
import {OrchardMintMetrics} from './mintmetrics.model';
import {ApiMintMetricsService} from './mintmetrics.service';

@Resolver()
export class MintMetricsResolver {
	private readonly logger = new Logger(MintMetricsResolver.name);

	constructor(private apiMintMetricsService: ApiMintMetricsService) {}

	@Query(() => [OrchardMintMetrics], {
		description:
			'Get mint server metrics scraped from the mint prometheus exporter. Throws on backends without metrics (e.g. nutshell).',
	})
	async mint_metrics(
		@Args('date_start', {type: () => UnixTimestamp, nullable: true, description: 'Start of date range filter'}) date_start?: number,
		@Args('date_end', {type: () => UnixTimestamp, nullable: true, description: 'End of date range filter'}) date_end?: number,
		@Args('interval', {type: () => SystemMetricsInterval, nullable: true, description: 'Time interval for data aggregation'})
		interval?: SystemMetricsInterval,
		@Args('timezone', {type: () => Timezone, nullable: true, description: 'Timezone for date calculations'}) timezone?: TimezoneType,
		@Args('metrics', {type: () => [String], nullable: true, description: 'List of specific metric families to retrieve'})
		metrics?: string[],
	): Promise<OrchardMintMetrics[]> {
		const tag = 'GET { mint_metrics }';
		this.logger.debug(tag);
		return await this.apiMintMetricsService.getMetrics(tag, {date_start, date_end, interval, timezone, metrics});
	}
}
