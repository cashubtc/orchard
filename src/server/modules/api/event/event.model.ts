/* Core Dependencies */
import {Field, ID, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '@server/modules/graphql/scalars/unixtimestamp.scalar';
import {
	EventLogActorType,
	EventLogSection,
	EventLogEntityType,
	EventLogType,
	EventLogStatus,
	EventLogDetailStatus,
} from '@server/modules/event/event.enums';
import {EventLog} from '@server/modules/event/event.entity';
import {EventLogDetail} from '@server/modules/event/event-detail.entity';

@ObjectType({description: 'Event log detail entry'})
export class OrchardEventLogDetail {
	@Field(() => ID, {description: 'Unique detail identifier'})
	id: string;

	@Field({description: 'Field name affected by the event'})
	field: string;

	@Field(() => String, {nullable: true, description: 'Previous value of the field'})
	old_value: string | null;

	@Field(() => String, {nullable: true, description: 'New value of the field'})
	new_value: string | null;

	@Field(() => EventLogDetailStatus, {description: 'Status of the detail entry'})
	status: EventLogDetailStatus;

	@Field(() => String, {nullable: true, description: 'Error code if the detail failed'})
	error_code: string | null;

	@Field(() => String, {nullable: true, description: 'Error message if the detail failed'})
	error_message: string | null;

	constructor(detail: EventLogDetail) {
		this.id = detail.id;
		this.field = detail.field;
		this.old_value = detail.old_value;
		this.new_value = detail.new_value;
		this.status = detail.status;
		this.error_code = detail.error_code;
		this.error_message = detail.error_message;
	}
}

@ObjectType({description: 'Event log entry'})
export class OrchardEventLog {
	@Field(() => ID, {description: 'Unique event log identifier'})
	id: string;

	@Field(() => EventLogActorType, {description: 'Type of actor that triggered the event'})
	actor_type: EventLogActorType;

	@Field({description: 'Identifier of the actor that triggered the event'})
	actor_id: string;

	@Field(() => UnixTimestamp, {description: 'Event timestamp'})
	timestamp: number;

	@Field(() => EventLogSection, {description: 'Section the event belongs to'})
	section: EventLogSection;

	@Field(() => String, {nullable: true, description: 'Identifier of the section instance'})
	section_id: string | null;

	@Field(() => EventLogEntityType, {description: 'Type of entity affected by the event'})
	entity_type: EventLogEntityType;

	@Field(() => String, {nullable: true, description: 'Identifier of the affected entity'})
	entity_id: string | null;

	@Field(() => EventLogType, {description: 'Type of event that occurred'})
	type: EventLogType;

	@Field(() => EventLogStatus, {description: 'Overall status of the event'})
	status: EventLogStatus;

	@Field(() => [OrchardEventLogDetail], {description: 'Detailed changes associated with the event'})
	details: OrchardEventLogDetail[];

	constructor(event: EventLog) {
		this.id = event.id;
		this.actor_type = event.actor_type;
		this.actor_id = event.actor_id;
		this.timestamp = event.timestamp;
		this.section = event.section;
		this.section_id = event.section_id;
		this.entity_type = event.entity_type;
		this.entity_id = event.entity_id;
		this.type = event.type;
		this.status = event.status;
		this.details = (event.details ?? []).map((detail) => new OrchardEventLogDetail(detail));
	}
}
