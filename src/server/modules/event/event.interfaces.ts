/* Application Dependencies */
import {EventLogMetadata} from '#server/modules/event/event.decorator';
/* Local Dependencies */
import {EventLogActorType, EventLogSection, EventLogEntityType, EventLogType, EventLogStatus, EventLogDetailStatus} from './event.enums.js';

export interface CreateEventLogInput {
	actor_type: EventLogActorType;
	actor_id: string;
	timestamp: number;
	section: EventLogSection;
	section_id?: string | null;
	entity_type: EventLogEntityType;
	entity_id?: string | null;
	type: EventLogType;
	status: EventLogStatus;
	details: CreateEventLogDetailInput[];
}

export interface CreateEventLogDetailInput {
	field: string;
	old_value?: string | null;
	new_value?: string | null;
	status: EventLogDetailStatus;
	error_code?: string | null;
	error_message?: string | null;
}

/** Extracted context from a GraphQL execution context for event logging */
export interface EventLogContext {
	metadata: EventLogMetadata;
	args: Record<string, any>;
	actor_id: string;
	actor_type: EventLogActorType;
}

/** Extracted error information from a GraphQL error */
export interface EventLogError {
	error_code: string | null;
	error_message: string | null;
}

export interface EventLogFilters {
	sections?: EventLogSection[];
	actor_types?: EventLogActorType[];
	actor_ids?: string[];
	entity_types?: EventLogEntityType[];
	types?: EventLogType[];
	statuses?: EventLogStatus[];
	date_start?: number;
	date_end?: number;
	page?: number;
	page_size?: number;
}
