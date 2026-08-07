/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
/* Vendor Dependencies */
import {Repository, SelectQueryBuilder} from 'typeorm';
/* Local Dependencies */
import {EventLog} from './event.entity.js';
import {EventLogDetail} from './event-detail.entity.js';
import {CreateEventLogInput, EventLogFilters} from './event.interfaces.js';

@Injectable()
export class EventLogService {
	private readonly logger = new Logger(EventLogService.name);

	constructor(
		@InjectRepository(EventLog)
		private eventRepository: Repository<EventLog>,
		@InjectRepository(EventLogDetail)
		private eventDetailRepository: Repository<EventLogDetail>,
	) {}

	/**
	 * Create a new event log with details
	 * @param {CreateEventLogInput} input - The event log data with details
	 * @returns {Promise<EventLog>} The created event log
	 */
	public async createEvent(input: CreateEventLogInput): Promise<EventLog> {
		const details = input.details.map((detail) =>
			this.eventDetailRepository.create({
				field: detail.field,
				old_value: detail.old_value ?? null,
				new_value: detail.new_value ?? null,
				status: detail.status,
				error_code: detail.error_code ?? null,
				error_message: detail.error_message ?? null,
			}),
		);
		const event = this.eventRepository.create({
			actor_type: input.actor_type,
			actor_id: input.actor_id,
			timestamp: input.timestamp,
			section: input.section,
			section_id: input.section_id ?? null,
			entity_type: input.entity_type,
			entity_id: input.entity_id,
			type: input.type,
			status: input.status,
			details,
		});
		const saved_event = await this.eventRepository.save(event);
		this.logger.debug(`Created event log: ${saved_event.id} [${input.section}/${input.entity_type}/${input.type}]`);
		return saved_event;
	}

	/**
	 * Fire-and-forget an event log. Skips empty details. Failures are caught and logged as warnings.
	 * @param {CreateEventLogInput} input - The complete event log input
	 */
	public logEvent(input: CreateEventLogInput): void {
		if (input.details.length === 0) return;
		this.createEvent(input).catch((err) => this.logger.warn(`Failed to log event [${input.entity_type}/${input.type}]: ${err}`));
	}

	/**
	 * Get event logs with optional filters
	 * @param {EventLogFilters} filters - Optional filters for querying events
	 * @returns {Promise<EventLog[]>} The matching event logs
	 */
	public async getEvents(filters: EventLogFilters = {}): Promise<EventLog[]> {
		const query = this.eventRepository.createQueryBuilder('event').leftJoinAndSelect('event.details', 'detail');
		this.applyFilters(query, filters);
		query.orderBy('event.timestamp', 'DESC');
		if (filters.page !== undefined && filters.page_size !== undefined) {
			query.skip(filters.page * filters.page_size).take(filters.page_size);
		}
		return query.getMany();
	}

	/**
	 * Get total count of event logs matching filters (excludes pagination)
	 * @param {EventLogFilters} filters - Optional filters for counting events
	 * @returns {Promise<number>} The count of matching event logs
	 */
	public async getEventCount(filters: EventLogFilters = {}): Promise<number> {
		const query = this.eventRepository.createQueryBuilder('event');
		this.applyFilters(query, filters);
		return query.getCount();
	}

	/**
	 * Apply shared filter conditions to a query builder
	 * @param {SelectQueryBuilder<EventLog>} query - The query builder to apply filters to
	 * @param {EventLogFilters} filters - The filters to apply
	 */
	private applyFilters(query: SelectQueryBuilder<EventLog>, filters: EventLogFilters): void {
		if (filters.sections && filters.sections.length > 0) {
			query.andWhere('event.section IN (:...sections)', {sections: filters.sections});
		}
		if (filters.actor_types && filters.actor_types.length > 0) {
			query.andWhere('event.actor_type IN (:...actor_types)', {actor_types: filters.actor_types});
		}
		if (filters.actor_ids && filters.actor_ids.length > 0) {
			query.andWhere('event.actor_id IN (:...actor_ids)', {actor_ids: filters.actor_ids});
		}
		if (filters.entity_types && filters.entity_types.length > 0) {
			query.andWhere('event.entity_type IN (:...entity_types)', {entity_types: filters.entity_types});
		}
		if (filters.types && filters.types.length > 0) {
			query.andWhere('event.type IN (:...types)', {types: filters.types});
		}
		if (filters.statuses && filters.statuses.length > 0) {
			query.andWhere('event.status IN (:...statuses)', {statuses: filters.statuses});
		}
		if (filters.date_start) {
			query.andWhere('event.timestamp >= :date_start', {date_start: filters.date_start});
		}
		if (filters.date_end) {
			query.andWhere('event.timestamp <= :date_end', {date_end: filters.date_end});
		}
	}

	/**
	 * Get the earliest event timestamp
	 * @returns {Promise<number>} The earliest timestamp, or 0 if no events exist
	 */
	public async getGenesisTimestamp(): Promise<number> {
		const result = await this.eventRepository.createQueryBuilder('event').select('MIN(event.timestamp)', 'min').getRawOne();
		return result?.min ?? 0;
	}

	/**
	 * Get a single event log with its details
	 * @param {string} id - The event log ID
	 * @returns {Promise<EventLog | null>} The event log with details, or null
	 */
	public async getEventWithDetails(id: string): Promise<EventLog | null> {
		return this.eventRepository.findOne({
			where: {id},
			relations: ['details'],
		});
	}
}
