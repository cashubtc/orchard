/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query, Args, Int} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';
import {EventLogActorType, EventLogSection, EventLogEntityType, EventLogType, EventLogStatus} from '#server/modules/event/event.enums';
import {OrchardCommonCount} from '#server/modules/api/common/entity-count.model';
import {OrchardCommonGenesis} from '#server/modules/api/common/entity-genesis.model';
/* Local Dependencies */
import {ApiEventLogService} from './event.service.js';
import {OrchardEventLog} from './event.model.js';

@Resolver()
export class EventLogResolver {
	private readonly logger = new Logger(EventLogResolver.name);

	constructor(private eventLogService: ApiEventLogService) {}

	@Query(() => [OrchardEventLog], {description: 'List event logs with optional filters'})
	async event_logs(
		@Args('sections', {type: () => [EventLogSection], nullable: true, description: 'Filter by event log sections'})
		sections?: EventLogSection[],
		@Args('actor_types', {type: () => [EventLogActorType], nullable: true, description: 'Filter by actor types'})
		actor_types?: EventLogActorType[],
		@Args('actor_ids', {type: () => [String], nullable: true, description: 'Filter by actor identifiers'}) actor_ids?: string[],
		@Args('types', {type: () => [EventLogType], nullable: true, description: 'Filter by event log types'}) types?: EventLogType[],
		@Args('statuses', {type: () => [EventLogStatus], nullable: true, description: 'Filter by event log statuses'})
		statuses?: EventLogStatus[],
		@Args('entity_types', {type: () => [EventLogEntityType], nullable: true, description: 'Filter by entity types'})
		entity_types?: EventLogEntityType[],
		@Args('date_start', {type: () => UnixTimestamp, nullable: true, description: 'Start of date range filter'}) date_start?: number,
		@Args('date_end', {type: () => UnixTimestamp, nullable: true, description: 'End of date range filter'}) date_end?: number,
		@Args('page', {type: () => Int, nullable: true, description: 'Page number for pagination'}) page?: number,
		@Args('page_size', {type: () => Int, nullable: true, description: 'Number of results per page'}) page_size?: number,
	): Promise<OrchardEventLog[]> {
		const tag = 'GET { event_logs }';
		this.logger.debug(tag);
		return await this.eventLogService.getEventLogs(tag, {
			sections,
			actor_types,
			actor_ids,
			types,
			statuses,
			entity_types,
			date_start,
			date_end,
			page,
			page_size,
		});
	}

	@Query(() => OrchardCommonCount, {description: 'Get total count of event logs matching filters'})
	async event_log_count(
		@Args('sections', {type: () => [EventLogSection], nullable: true, description: 'Filter by event log sections'})
		sections?: EventLogSection[],
		@Args('actor_types', {type: () => [EventLogActorType], nullable: true, description: 'Filter by actor types'})
		actor_types?: EventLogActorType[],
		@Args('actor_ids', {type: () => [String], nullable: true, description: 'Filter by actor identifiers'}) actor_ids?: string[],
		@Args('types', {type: () => [EventLogType], nullable: true, description: 'Filter by event log types'}) types?: EventLogType[],
		@Args('statuses', {type: () => [EventLogStatus], nullable: true, description: 'Filter by event log statuses'})
		statuses?: EventLogStatus[],
		@Args('entity_types', {type: () => [EventLogEntityType], nullable: true, description: 'Filter by entity types'})
		entity_types?: EventLogEntityType[],
		@Args('date_start', {type: () => UnixTimestamp, nullable: true, description: 'Start of date range filter'}) date_start?: number,
		@Args('date_end', {type: () => UnixTimestamp, nullable: true, description: 'End of date range filter'}) date_end?: number,
	): Promise<OrchardCommonCount> {
		const tag = 'GET { event_log_count }';
		this.logger.debug(tag);
		return await this.eventLogService.getEventLogCount(tag, {
			sections,
			actor_types,
			actor_ids,
			types,
			statuses,
			entity_types,
			date_start,
			date_end,
		});
	}

	@Query(() => OrchardCommonGenesis, {description: 'Get earliest event log timestamp'})
	async event_log_genesis(): Promise<OrchardCommonGenesis> {
		const tag = 'GET { event_log_genesis }';
		this.logger.debug(tag);
		return await this.eventLogService.getGenesisTimestamp(tag);
	}
}
