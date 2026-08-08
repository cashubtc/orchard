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
import type {EventLogError} from '#server/modules/event/event.interfaces';
import {SettingService} from '#server/modules/setting/setting.service';
import {SettingKey} from '#server/modules/setting/setting.enums';
import {isSettingSensitive, maskSensitiveValue} from '#server/modules/setting/setting.helpers';

@Injectable()
export class SettingInterceptor implements NestInterceptor {
	private readonly logger = new Logger(SettingInterceptor.name);

	constructor(
		private reflector: Reflector,
		private eventLogService: EventLogService,
		private settingService: SettingService,
	) {}

	async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
		const event_context = extractEventContext(context, this.reflector);
		if (!event_context) return next.handle();
		const {metadata, args, actor_id, actor_type} = event_context;
		const keys: SettingKey[] = args.keys ?? [];
		const values: string[] = args.values ?? [];
		const old_values = await this.fetchOldValues(keys);

		return next.handle().pipe(
			tap(() => {
				for (let i = 0; i < keys.length; i++) {
					this.logEvent(metadata, actor_type, actor_id, keys[i], old_values[i], values[i] ?? null, EventLogStatus.SUCCESS);
				}
			}),
			catchError((error) => {
				const event_error = extractEventError(error);
				for (let i = 0; i < keys.length; i++) {
					this.logEvent(
						metadata,
						actor_type,
						actor_id,
						keys[i],
						old_values[i],
						values[i] ?? null,
						EventLogStatus.ERROR,
						event_error,
					);
				}
				throw error;
			}),
		);
	}

	/**
	 * Fetch old values from the settings database for UPDATE type events
	 * @param {SettingKey[]} keys - The setting keys to look up
	 * @returns {Promise<(string | null)[]>} The previous values
	 */
	private async fetchOldValues(keys: SettingKey[]): Promise<(string | null)[]> {
		return Promise.all(
			keys.map(async (key) => {
				try {
					const setting = await this.settingService.getSetting(key);
					return setting?.value ?? null;
				} catch (_error) {
					this.logger.warn(`Failed to fetch old value for setting [${key}]`);
					return null;
				}
			}),
		);
	}

	/**
	 * Fire-and-forget an event log to the event history
	 * @param {EventLogMetadata} metadata - The event log configuration
	 * @param {EventLogActorType} actor_type - The actor type (user or agent)
	 * @param {string} actor_id - The actor ID
	 * @param {SettingKey} key - The setting key being updated
	 * @param {string | null} old_value - The previous value
	 * @param {string | null} new_value - The new value
	 * @param {EventLogStatus} status - Success or error
	 * @param {EventLogError} error - Optional error details
	 */
	private logEvent(
		metadata: EventLogMetadata,
		actor_type: EventLogActorType,
		actor_id: string,
		key: SettingKey,
		old_value: string | null,
		new_value: string | null,
		status: EventLogStatus,
		error?: EventLogError,
	): void {
		const sensitive = isSettingSensitive(key, new_value ?? old_value ?? '');
		const safe_old = sensitive && old_value ? maskSensitiveValue(old_value) : old_value;
		const safe_new = sensitive && new_value ? maskSensitiveValue(new_value) : new_value;
		const detail_status = status === EventLogStatus.SUCCESS ? EventLogDetailStatus.SUCCESS : EventLogDetailStatus.ERROR;
		this.eventLogService.logEvent({
			actor_type,
			actor_id,
			timestamp: eventTimestamp(),
			section: EventLogSection.SETTINGS,
			section_id: null,
			entity_type: EventLogEntityType.SETTING,
			entity_id: key,
			type: metadata.type,
			status,
			details: [
				{
					field: key,
					old_value: safe_old,
					new_value: safe_new,
					status: detail_status,
					error_code: error?.error_code ?? null,
					error_message: error?.error_message ?? null,
				},
			],
		});
	}
}
