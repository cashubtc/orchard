/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {EventLogService} from '#server/modules/event/event.service';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {EventLogFilters} from '#server/modules/event/event.interfaces';
import {OrchardCommonCount} from '#server/modules/api/common/entity-count.model';
import {OrchardCommonGenesis} from '#server/modules/api/common/entity-genesis.model';
/* Local Dependencies */
import {OrchardEventLog} from './event.model.js';

@Injectable()
export class ApiEventLogService {
	private readonly logger = new Logger(ApiEventLogService.name);

	constructor(
		private eventLogService: EventLogService,
		private errorService: ErrorService,
	) {}

	/**
	 * Get event logs with optional filters
	 * @param {string} tag - Logging tag
	 * @param {EventLogFilters} filters - Optional filters
	 * @returns {Promise<OrchardEventLog[]>} The event logs
	 */
	async getEventLogs(tag: string, filters: EventLogFilters = {}): Promise<OrchardEventLog[]> {
		try {
			const events = await this.eventLogService.getEvents(filters);
			return events.map((event) => new OrchardEventLog(event));
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.EventLogError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	/**
	 * Get count of event logs matching filters
	 * @param {string} tag - Logging tag
	 * @param {EventLogFilters} filters - Optional filters
	 * @returns {Promise<OrchardCommonCount>} The count result
	 */
	async getEventLogCount(tag: string, filters: EventLogFilters = {}): Promise<OrchardCommonCount> {
		try {
			const count = await this.eventLogService.getEventCount(filters);
			return new OrchardCommonCount(count);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.EventLogError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	/**
	 * Get the earliest event timestamp
	 * @param {string} tag - Logging tag
	 * @returns {Promise<OrchardCommonGenesis>} The genesis timestamp
	 */
	async getGenesisTimestamp(tag: string): Promise<OrchardCommonGenesis> {
		try {
			const timestamp = await this.eventLogService.getGenesisTimestamp();
			return new OrchardCommonGenesis(timestamp);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.EventLogError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}
}
