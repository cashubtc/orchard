/* Core Dependencies */
import {SetMetadata} from '@nestjs/common';
/* Application Dependencies */
import {EventLogType} from '#server/modules/event/event.enums';

export const EVENT_LOG_KEY = 'event_log';

export interface EventLogMetadata {
	field: string;
	type: EventLogType;
	arg_keys?: string[];
	old_value_key?: string;
}

/**
 * Decorator that marks a resolver method for event log tracking.
 * Used with an event log interceptor to automatically log events.
 * @param {EventLogMetadata} metadata - The event log configuration
 */
export const LogEvent = (metadata: EventLogMetadata) => SetMetadata(EVENT_LOG_KEY, metadata);
