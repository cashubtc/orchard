/* Core Dependencies */
import {Pipe, PipeTransform} from '@angular/core';
/* Shared Dependencies */
import {EventLogEntityType, EventLogType} from '@shared/generated.types';

/** Maps EventLogEntityType enum values to title-cased display strings */
const ENTITY_TYPE_LABELS: Record<EventLogEntityType, string> = {
	[EventLogEntityType.Database]: 'Database',
	[EventLogEntityType.Info]: 'Info',
	[EventLogEntityType.Keyset]: 'Keyset',
	[EventLogEntityType.Nut04]: 'Nut04',
	[EventLogEntityType.Nut05]: 'Nut05',
	[EventLogEntityType.Quote]: 'Quote',
	[EventLogEntityType.QuoteTtl]: 'Quote Expiry',
	[EventLogEntityType.Setting]: 'Setting',
	[EventLogEntityType.Agent]: 'Agent',
	[EventLogEntityType.Ecash]: 'Ecash',
};

/** Maps EventLogType enum values to past-tense display strings */
const TYPE_LABELS: Record<EventLogType, string> = {
	[EventLogType.Create]: 'Created',
	[EventLogType.Delete]: 'Deleted',
	[EventLogType.Execute]: 'Executed',
	[EventLogType.Update]: 'Updated',
};

@Pipe({
	name: 'eventLogEvent',
	standalone: false,
	pure: true,
})
export class EventLogEventPipe implements PipeTransform {
	/** Transforms entity_type + type into a readable event string (e.g. "Quote Expiry Updated") */
	transform(entity_type: EventLogEntityType, type: EventLogType): string {
		return `${ENTITY_TYPE_LABELS[entity_type] ?? entity_type} ${TYPE_LABELS[type] ?? type}`;
	}
}
