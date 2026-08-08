/* Core Dependencies */
import {Injectable, Logger, CallHandler, ExecutionContext, NestInterceptor} from '@nestjs/common';
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
import type {CreateEventLogDetailInput} from '#server/modules/event/event.interfaces';
import {CashuMintRpcService} from '#server/modules/cashu/mintrpc/cashumintrpc.service';
/* Local Dependencies */
import {OrchardMintQuoteTtls} from './mintquote.model.js';
import {MintQuoteTtlUpdateInput} from './mintquote.input.js';

@Injectable()
export class MintQuoteInterceptor implements NestInterceptor {
	private readonly logger = new Logger(MintQuoteInterceptor.name);

	constructor(
		private reflector: Reflector,
		private eventLogService: EventLogService,
		private cashuMintRpcService: CashuMintRpcService,
	) {}

	async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
		const event_context = extractEventContext(context, this.reflector);
		if (!event_context) return next.handle();
		const {metadata, args, actor_id, actor_type} = event_context;
		const input: MintQuoteTtlUpdateInput = args.mint_quote_ttl_update;
		const old_ttls = await this.fetchOldTtls();
		const details = this.buildEventDetails(input, old_ttls);

		return next.handle().pipe(
			tap(() => {
				this.logEvent(metadata, actor_type, actor_id, details, EventLogStatus.SUCCESS);
			}),
			catchError((error) => {
				const {error_code, error_message} = extractEventError(error);
				const error_details = details.map((detail) => ({
					...detail,
					status: EventLogDetailStatus.ERROR,
					error_code,
					error_message,
				}));
				this.logEvent(metadata, actor_type, actor_id, error_details, EventLogStatus.ERROR);
				throw error;
			}),
		);
	}

	/**
	 * Fetch current quote TTLs for old value comparison
	 * @returns {Promise<OrchardMintQuoteTtls | null>} The current TTL values
	 */
	private async fetchOldTtls(): Promise<OrchardMintQuoteTtls | null> {
		try {
			return await this.cashuMintRpcService.getQuoteTtl();
		} catch (_error) {
			this.logger.warn('Failed to fetch old TTL values for event history');
			return null;
		}
	}

	/**
	 * Build event detail entries for each TTL field in the input
	 * @param {MintQuoteTtlUpdateInput} input - The update input
	 * @param {OrchardMintQuoteTtls | null} old_ttls - The previous TTL values
	 * @returns {CreateEventLogDetailInput[]} The event details
	 */
	private buildEventDetails(input: MintQuoteTtlUpdateInput, old_ttls: OrchardMintQuoteTtls | null): CreateEventLogDetailInput[] {
		const details: CreateEventLogDetailInput[] = [];
		const fields: (keyof MintQuoteTtlUpdateInput)[] = ['mint_ttl', 'melt_ttl'];
		for (const field of fields) {
			if (input[field] === undefined || input[field] === null) continue;
			details.push({
				field,
				old_value: old_ttls?.[field] != null ? String(old_ttls[field]) : null,
				new_value: String(input[field]),
				status: EventLogDetailStatus.SUCCESS,
			});
		}
		return details;
	}

	/**
	 * Fire-and-forget an event log to the event history
	 * @param {EventLogMetadata} metadata - The event log configuration
	 * @param {EventLogActorType} actor_type - The actor type (user or agent)
	 * @param {string} actor_id - The actor ID
	 * @param {CreateEventLogDetailInput[]} details - The event details
	 * @param {EventLogStatus} status - Success or error
	 */
	private logEvent(
		metadata: EventLogMetadata,
		actor_type: EventLogActorType,
		actor_id: string,
		details: CreateEventLogDetailInput[],
		status: EventLogStatus,
	): void {
		this.eventLogService.logEvent({
			actor_type,
			actor_id,
			timestamp: eventTimestamp(),
			section: EventLogSection.MINT,
			section_id: '1',
			entity_type: EventLogEntityType.QUOTE_TTL,
			entity_id: null,
			type: metadata.type,
			status,
			details,
		});
	}
}
