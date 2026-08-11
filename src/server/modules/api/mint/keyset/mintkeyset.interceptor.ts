/* Core Dependencies */
import {Injectable, Logger, type CallHandler, type ExecutionContext, type NestInterceptor} from '@nestjs/common';
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
import type {CreateEventLogDetailInput} from '#server/modules/event/event.interfaces';
import {CashuMintDatabaseService} from '#server/modules/cashu/mintdb/cashumintdb.service';
import type {CashuMintKeyset} from '#server/modules/cashu/mintdb/cashumintdb.types';
import {MintService} from '#server/modules/api/mint/mint.service';
/* Local Dependencies */
import {OrchardMintKeysetRotation} from './mintkeyset.model.js';

@Injectable()
export class MintKeysetInterceptor implements NestInterceptor {
	private readonly logger = new Logger(MintKeysetInterceptor.name);

	constructor(
		private reflector: Reflector,
		private eventLogService: EventLogService,
		private cashuMintDatabaseService: CashuMintDatabaseService,
		private mintService: MintService,
	) {}

	async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
		const event_context = extractEventContext(context, this.reflector);
		if (!event_context) return next.handle();
		const {metadata, args, actor_id, actor_type} = event_context;

		return next.handle().pipe(
			tap((result: OrchardMintKeysetRotation) => {
				this.logRotation(actor_type, actor_id, args, result, EventLogStatus.SUCCESS);
			}),
			catchError((error) => {
				this.logger.error(`Error during keyset rotation [${metadata.field}]: ${error}`);
				const {error_code, error_message} = extractEventError(error);
				const error_details: CreateEventLogDetailInput[] = [
					{
						field: 'unit',
						new_value: String(args.unit),
						status: EventLogDetailStatus.ERROR,
						error_code,
						error_message,
					},
				];
				this.logEvent(actor_type, actor_id, EventLogType.CREATE, null, error_details, EventLogStatus.ERROR);
				throw error;
			}),
		);
	}

	/**
	 * Log both the old keyset deactivation and new keyset creation after a successful rotation
	 * @param {EventLogActorType} actor_type - The actor type (user or agent)
	 * @param {string} actor_id - The actor ID
	 * @param {Record<string, any>} args - The resolver arguments
	 * @param {OrchardMintKeysetRotation} result - The mutation result containing the new keyset
	 * @param {EventLogStatus} status - Success or error
	 */
	private async logRotation(
		actor_type: EventLogActorType,
		actor_id: string,
		args: Record<string, any>,
		result: OrchardMintKeysetRotation,
		status: EventLogStatus,
	): Promise<void> {
		const keysets = await this.fetchKeysets();
		const old_keyset = this.findOldKeyset(keysets, result);

		if (old_keyset) {
			this.logEvent(
				actor_type,
				actor_id,
				EventLogType.UPDATE,
				old_keyset.id,
				[{field: 'active', old_value: 'true', new_value: 'false', status: EventLogDetailStatus.SUCCESS}],
				status,
			);
		}

		const create_details: CreateEventLogDetailInput[] = [
			{field: 'unit', new_value: String(result.unit), status: EventLogDetailStatus.SUCCESS},
		];
		if (result.amounts != null) {
			create_details.push({field: 'amounts', new_value: JSON.stringify(result.amounts), status: EventLogDetailStatus.SUCCESS});
		}
		if (result.input_fee_ppk != null) {
			create_details.push({field: 'input_fee_ppk', new_value: String(result.input_fee_ppk), status: EventLogDetailStatus.SUCCESS});
		}
		if (args.keyset_v2 != null) {
			create_details.push({field: 'keyset_v2', new_value: String(args.keyset_v2), status: EventLogDetailStatus.SUCCESS});
		}

		this.logEvent(actor_type, actor_id, EventLogType.CREATE, result.id, create_details, status);
	}

	/**
	 * Fetch all keysets from the mint database
	 * @returns {Promise<CashuMintKeyset[]>} The list of keysets
	 */
	private async fetchKeysets(): Promise<CashuMintKeyset[]> {
		try {
			return await this.mintService.withDbClient(async (client) => {
				return this.cashuMintDatabaseService.getKeysets(client);
			});
		} catch (_error) {
			this.logger.warn('Failed to fetch keysets for event history');
			return [];
		}
	}

	/**
	 * Find the old keyset that was deactivated during rotation.
	 * The old keyset has derivation_path_index one below the new keyset's index, for the same unit.
	 * @param {CashuMintKeyset[]} keysets - All keysets from the database
	 * @param {OrchardMintKeysetRotation} result - The newly created keyset
	 * @returns {CashuMintKeyset | null} The old keyset or null if not found
	 */
	private findOldKeyset(keysets: CashuMintKeyset[], result: OrchardMintKeysetRotation): CashuMintKeyset | null {
		const new_keyset = keysets.find((k) => k.id === result.id);
		if (!new_keyset) return null;
		return keysets.find((k) => k.unit === new_keyset.unit && k.derivation_path_index === new_keyset.derivation_path_index - 1) ?? null;
	}

	/**
	 * Fire-and-forget an event log to the event history
	 * @param {EventLogActorType} actor_type - The actor type (user or agent)
	 * @param {string} actor_id - The actor ID
	 * @param {EventLogType} type - The event type (CREATE or UPDATE)
	 * @param {string | null} entity_id - The entity identifier
	 * @param {CreateEventLogDetailInput[]} details - The event details
	 * @param {EventLogStatus} status - Success or error
	 */
	private logEvent(
		actor_type: EventLogActorType,
		actor_id: string,
		type: EventLogType,
		entity_id: string | null,
		details: CreateEventLogDetailInput[],
		status: EventLogStatus,
	): void {
		this.eventLogService.logEvent({
			actor_type,
			actor_id,
			timestamp: eventTimestamp(),
			section: EventLogSection.MINT,
			section_id: '1',
			entity_type: EventLogEntityType.KEYSET,
			entity_id,
			type,
			status,
			details,
		});
	}
}
