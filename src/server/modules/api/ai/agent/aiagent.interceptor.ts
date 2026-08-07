/* Core Dependencies */
import {Injectable, Logger, CallHandler, ExecutionContext, NestInterceptor} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
/* Vendor Dependencies */
import {Observable, tap, catchError} from 'rxjs';
/* Application Dependencies */
import {EventLogService} from '@server/modules/event/event.service';
import {EventLogMetadata} from '@server/modules/event/event.decorator';
import {
	EventLogActorType,
	EventLogSection,
	EventLogEntityType,
	EventLogType,
	EventLogStatus,
	EventLogDetailStatus,
} from '@server/modules/event/event.enums';
import {extractEventContext, extractEventError, eventTimestamp} from '@server/modules/event/event.helpers';
import {CreateEventLogDetailInput} from '@server/modules/event/event.interfaces';
/* Local Dependencies */
import {AiAgentService} from './aiagent.service.js';
import {OrchardAgent} from './aiagent.model.js';

/** Fields tracked for agent event logging */
const TRACKED_FIELDS: ReadonlyArray<keyof OrchardAgent> = [
	'name',
	'description',
	'active',
	'model',
	'system_message',
	'tools',
	'schedules',
];

@Injectable()
export class AiAgentInterceptor implements NestInterceptor {
	private readonly logger = new Logger(AiAgentInterceptor.name);

	constructor(
		private reflector: Reflector,
		private eventLogService: EventLogService,
		private aiAgentService: AiAgentService,
	) {}

	async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
		const event_context = extractEventContext(context, this.reflector);
		if (!event_context) return next.handle();
		const {metadata, args, actor_id, actor_type} = event_context;

		const old_agent = await this.fetchOldAgent(metadata, args);

		return next.handle().pipe(
			tap((result) => {
				const details = this.buildDetails(metadata, args, old_agent);
				const entity_id = args.id ?? result?.id ?? null;
				this.logEvent(metadata, actor_type, actor_id, entity_id, details, EventLogStatus.SUCCESS);
			}),
			catchError((error) => {
				const {error_code, error_message} = extractEventError(error);
				const details = this.buildDetails(metadata, args, old_agent).map((detail) => ({
					...detail,
					status: EventLogDetailStatus.ERROR,
					error_code,
					error_message,
				}));
				const entity_id = args.id ?? null;
				this.logEvent(metadata, actor_type, actor_id, entity_id, details, EventLogStatus.ERROR);
				throw error;
			}),
		);
	}

	/**
	 * Fetch the existing agent for UPDATE and DELETE operations
	 * @param {EventLogMetadata} metadata - The event log configuration
	 * @param {Record<string, any>} args - The GraphQL resolver args
	 * @returns {Promise<OrchardAgent | null>} The existing agent or null
	 */
	private async fetchOldAgent(metadata: EventLogMetadata, args: Record<string, any>): Promise<OrchardAgent | null> {
		if (metadata.type === EventLogType.CREATE) return null;
		try {
			return await this.aiAgentService.getAgent('EVENT { ai_agent }', args.id);
		} catch (_error) {
			this.logger.warn('Failed to fetch old agent for event history');
			return null;
		}
	}

	/**
	 * Build event detail entries based on the operation type
	 * @param {EventLogMetadata} metadata - The event log configuration
	 * @param {Record<string, any>} args - The GraphQL resolver args
	 * @param {OrchardAgent | null} old_agent - The agent state before the operation
	 * @returns {CreateEventLogDetailInput[]} The event details
	 */
	private buildDetails(
		metadata: EventLogMetadata,
		args: Record<string, any>,
		old_agent: OrchardAgent | null,
	): CreateEventLogDetailInput[] {
		switch (metadata.type) {
			case EventLogType.CREATE:
				return this.buildCreateDetails(args);
			case EventLogType.UPDATE:
				return this.buildUpdateDetails(args, old_agent);
			case EventLogType.DELETE:
				return this.buildDeleteDetails(old_agent);
			default:
				return [];
		}
	}

	/**
	 * Build details for a CREATE operation — all provided args as new values
	 * @param {Record<string, any>} args - The GraphQL resolver args
	 * @returns {CreateEventLogDetailInput[]} The event details
	 */
	private buildCreateDetails(args: Record<string, any>): CreateEventLogDetailInput[] {
		const details: CreateEventLogDetailInput[] = [];
		for (const field of TRACKED_FIELDS) {
			if (args[field] === undefined || args[field] === null) continue;
			details.push({
				field,
				new_value: this.stringify(args[field]),
				status: EventLogDetailStatus.SUCCESS,
			});
		}
		return details;
	}

	/**
	 * Build details for an UPDATE operation — compare old agent vs new args
	 * @param {Record<string, any>} args - The GraphQL resolver args
	 * @param {OrchardAgent | null} old_agent - The agent state before the update
	 * @returns {CreateEventLogDetailInput[]} The event details
	 */
	private buildUpdateDetails(args: Record<string, any>, old_agent: OrchardAgent | null): CreateEventLogDetailInput[] {
		const details: CreateEventLogDetailInput[] = [];
		for (const field of TRACKED_FIELDS) {
			if (args[field] === undefined) continue;
			details.push({
				field,
				old_value: old_agent ? this.stringify(old_agent[field]) : null,
				new_value: this.stringify(args[field]),
				status: EventLogDetailStatus.SUCCESS,
			});
		}
		return details;
	}

	/**
	 * Build details for a DELETE operation — all old agent fields as old values
	 * @param {OrchardAgent | null} old_agent - The agent state before deletion
	 * @returns {CreateEventLogDetailInput[]} The event details
	 */
	private buildDeleteDetails(old_agent: OrchardAgent | null): CreateEventLogDetailInput[] {
		if (!old_agent) return [];
		const details: CreateEventLogDetailInput[] = [];
		for (const field of TRACKED_FIELDS) {
			const value = old_agent[field];
			if (value === undefined || value === null) continue;
			details.push({
				field,
				old_value: this.stringify(value),
				status: EventLogDetailStatus.SUCCESS,
			});
		}
		return details;
	}

	/**
	 * Stringify a value for event logging (handles arrays and primitives)
	 * @param {any} value - The value to stringify
	 * @returns {string} The stringified value
	 */
	private stringify(value: any): string {
		if (Array.isArray(value)) return JSON.stringify(value);
		return String(value);
	}

	/**
	 * Fire-and-forget an event log to the event history
	 * @param {EventLogMetadata} metadata - The event log configuration
	 * @param {EventLogActorType} actor_type - The actor type (user or agent)
	 * @param {string} actor_id - The actor ID
	 * @param {string | null} entity_id - The agent entity ID
	 * @param {CreateEventLogDetailInput[]} details - The event details
	 * @param {EventLogStatus} status - Success or error
	 */
	private logEvent(
		metadata: EventLogMetadata,
		actor_type: EventLogActorType,
		actor_id: string,
		entity_id: string | null,
		details: CreateEventLogDetailInput[],
		status: EventLogStatus,
	): void {
		this.eventLogService.logEvent({
			actor_type,
			actor_id,
			timestamp: eventTimestamp(),
			section: EventLogSection.AI,
			section_id: null,
			entity_type: EventLogEntityType.AGENT,
			entity_id,
			type: metadata.type,
			status,
			details,
		});
	}
}
