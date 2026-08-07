/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query, Args} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';
import {Timezone, TimezoneType} from '#server/modules/graphql/scalars/timezone.scalar';
/* Native Dependencies */
import {SystemMetric, SystemMetricsInterval} from '#server/modules/system/metrics/sysmetrics.enums';
/* Local Dependencies */
import {OrchardSystemMetrics} from './sysmetrics.model.js';
import {ApiSystemMetricsService} from './sysmetrics.service.js';

@Resolver()
export class SystemMetricsResolver {
	private readonly logger = new Logger(SystemMetricsResolver.name);

	constructor(private apiSystemMetricsService: ApiSystemMetricsService) {}

	@Query(() => [OrchardSystemMetrics], {description: 'Get system performance metrics'})
	async system_metrics(
		@Args('date_start', {type: () => UnixTimestamp, nullable: true, description: 'Start of date range filter'}) date_start?: number,
		@Args('date_end', {type: () => UnixTimestamp, nullable: true, description: 'End of date range filter'}) date_end?: number,
		@Args('interval', {type: () => SystemMetricsInterval, nullable: true, description: 'Time interval for data aggregation'})
		interval?: SystemMetricsInterval,
		@Args('timezone', {type: () => Timezone, nullable: true, description: 'Timezone for date calculations'}) timezone?: TimezoneType,
		@Args('metrics', {type: () => [SystemMetric], nullable: true, description: 'List of specific metrics to retrieve'})
		metrics?: SystemMetric[],
	): Promise<OrchardSystemMetrics[]> {
		const tag = 'GET { system_metrics }';
		this.logger.debug(tag);
		return await this.apiSystemMetricsService.getMetrics(tag, {date_start, date_end, interval, timezone, metrics});
	}
}
