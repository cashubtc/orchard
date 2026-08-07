/* Core Dependencies */
import {Injectable, Logger, CallHandler, ExecutionContext, NestInterceptor} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
/* Vendor Dependencies */
import {Observable, tap, catchError} from 'rxjs';
/* Application Dependencies */
import {EventLogService} from '#server/modules/event/event.service';
import {
	EventLogActorType,
	EventLogSection,
	EventLogEntityType,
	EventLogType,
	EventLogStatus,
	EventLogDetailStatus,
} from '#server/modules/event/event.enums';
import {extractEventContext, extractEventError, eventTimestamp} from '#server/modules/event/event.helpers';
import {EventLogMetadata} from '#server/modules/event/event.decorator';
import {EventLogError} from '#server/modules/event/event.interfaces';
import {CashuMintRpcService} from '#server/modules/cashu/mintrpc/cashumintrpc.service';

@Injectable()
export class MintInfoInterceptor implements NestInterceptor {
	private readonly logger = new Logger(MintInfoInterceptor.name);

	constructor(
		private reflector: Reflector,
		private eventLogService: EventLogService,
		private cashuMintRpcService: CashuMintRpcService,
	) {}

	async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
		const event_context = extractEventContext(context, this.reflector);
		if (!event_context) return next.handle();
		const {metadata, args, actor_id, actor_type} = event_context;

		const arg_value = this.extractArgValue(args, metadata.arg_keys);
		const new_value = metadata.type !== EventLogType.DELETE ? arg_value : null;
		const old_value = metadata.type === EventLogType.DELETE ? arg_value : await this.fetchOldValue(metadata);

		return next.handle().pipe(
			tap(() => {
				this.logEvent(metadata, actor_type, actor_id, old_value, new_value, EventLogStatus.SUCCESS);
			}),
			catchError((error) => {
				this.logEvent(metadata, actor_type, actor_id, old_value, new_value, EventLogStatus.ERROR, extractEventError(error));
				throw error;
			}),
		);
	}

	/**
	 * Extract a joined value from resolver args
	 * @param {Record<string, any>} args - The resolver arguments
	 * @param {string[]} arg_keys - Keys to extract and join
	 * @returns {string | null} The extracted value
	 */
	private extractArgValue(args: Record<string, any>, arg_keys?: string[]): string | null {
		if (!arg_keys?.length) return null;
		if (arg_keys.length === 1) return args[arg_keys[0]] ?? null;
		return JSON.stringify(Object.fromEntries(arg_keys.map((key) => [key, args[key]])));
	}

	/**
	 * Fetch old value from mint info for UPDATE type events
	 * @param {EventLogMetadata} metadata - The event log configuration
	 * @returns {Promise<string | null>} The previous value
	 */
	private async fetchOldValue(metadata: EventLogMetadata): Promise<string | null> {
		if (metadata.type !== EventLogType.UPDATE || !metadata.old_value_key) return null;
		try {
			const mint_info = await this.cashuMintRpcService.getMintInfo();
			return (mint_info as any)[metadata.old_value_key] ?? null;
		} catch (_error) {
			this.logger.warn(`Failed to fetch old value for event history [${metadata.field}]`);
			return null;
		}
	}

	/**
	 * Fire-and-forget an event log to the event history
	 * @param {EventLogMetadata} metadata - The event log configuration
	 * @param {EventLogActorType} actor_type - The actor type (user or agent)
	 * @param {string} actor_id - The actor ID
	 * @param {string | null} old_value - The previous value
	 * @param {string | null} new_value - The new value
	 * @param {EventLogStatus} status - Success or error
	 * @param {EventLogError} error - Optional error details
	 */
	private logEvent(
		metadata: EventLogMetadata,
		actor_type: EventLogActorType,
		actor_id: string,
		old_value: string | null,
		new_value: string | null,
		status: EventLogStatus,
		error?: EventLogError,
	): void {
		const detail_status = status === EventLogStatus.SUCCESS ? EventLogDetailStatus.SUCCESS : EventLogDetailStatus.ERROR;
		this.eventLogService.logEvent({
			actor_type,
			actor_id,
			timestamp: eventTimestamp(),
			section: EventLogSection.MINT,
			section_id: '1',
			entity_type: EventLogEntityType.INFO,
			entity_id: null,
			type: metadata.type,
			status,
			details: [
				{
					field: metadata.field,
					old_value,
					new_value,
					status: detail_status,
					error_code: error?.error_code ?? null,
					error_message: error?.error_message ?? null,
				},
			],
		});
	}
}
