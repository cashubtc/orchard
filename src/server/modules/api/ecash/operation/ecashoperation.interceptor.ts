/* Core Dependencies */
import {Injectable, type CallHandler, type ExecutionContext, type NestInterceptor} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
/* Vendor Dependencies */
import {Observable, tap, catchError} from 'rxjs';
/* Application Dependencies */
import {EventLogService} from '#server/modules/event/event.service';
import type {EventLogMetadata} from '#server/modules/event/event.decorator';
import {
	EventLogActorType,
	EventLogSection,
	EventLogEntityType,
	EventLogStatus,
	EventLogDetailStatus,
} from '#server/modules/event/event.enums';
import {extractEventContext, extractEventError, eventTimestamp} from '#server/modules/event/event.helpers';
import type {CreateEventLogDetailInput, EventLogError} from '#server/modules/event/event.interfaces';
/* Local Dependencies */
import type {OrchardEcashOperation} from './ecashoperation.model.js';

@Injectable()
export class EcashOperationInterceptor implements NestInterceptor {
	constructor(
		private reflector: Reflector,
		private eventLogService: EventLogService,
	) {}

	async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
		const event_context = extractEventContext(context, this.reflector);
		if (!event_context) return next.handle();
		const {metadata, args, actor_id, actor_type} = event_context;

		return next.handle().pipe(
			tap((operation: OrchardEcashOperation) => {
				this.logEvent(metadata, actor_type, actor_id, operation.id, args, EventLogStatus.SUCCESS);
			}),
			catchError((error) => {
				this.logEvent(metadata, actor_type, actor_id, null, args, EventLogStatus.ERROR, extractEventError(error));
				throw error;
			}),
		);
	}

	/**
	 * Fire-and-forget an issue to the event history, one detail per issued field
	 * @param {EventLogMetadata} metadata - The event log configuration
	 * @param {EventLogActorType} actor_type - The actor type (user or agent)
	 * @param {string} actor_id - The actor ID
	 * @param {string | null} operation_id - The wallet operation, when the issue started
	 * @param {Record<string, any>} args - The resolver arguments
	 * @param {EventLogStatus} status - Success or error
	 * @param {EventLogError} error - Optional error details
	 */
	private logEvent(
		metadata: EventLogMetadata,
		actor_type: EventLogActorType,
		actor_id: string,
		operation_id: string | null,
		args: Record<string, any>,
		status: EventLogStatus,
		error?: EventLogError,
	): void {
		const detail_status = status === EventLogStatus.SUCCESS ? EventLogDetailStatus.SUCCESS : EventLogDetailStatus.ERROR;
		const details: CreateEventLogDetailInput[] = ['amount', 'unit', 'memo']
			.filter((field) => args[field] != null)
			.map((field) => ({
				field,
				new_value: String(args[field]),
				status: detail_status,
				error_code: error?.error_code ?? null,
				error_message: error?.error_message ?? null,
			}));
		this.eventLogService.logEvent({
			actor_type,
			actor_id,
			timestamp: eventTimestamp(),
			section: EventLogSection.ECASH,
			section_id: null,
			entity_type: EventLogEntityType.ECASH,
			entity_id: operation_id,
			type: metadata.type,
			status,
			details,
		});
	}
}
