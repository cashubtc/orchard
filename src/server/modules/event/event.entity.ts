/* Vendor Dependencies */
import {Entity, Column, PrimaryGeneratedColumn, OneToMany} from 'typeorm';
/* Local Dependencies */
import {EventLogActorType, EventLogSection, EventLogEntityType, EventLogType, EventLogStatus} from './event.enums.js';
import {EventLogDetail} from './event-detail.entity.js';

@Entity('events')
export class EventLog {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({type: 'text'})
	actor_type: EventLogActorType;

	@Column({type: 'text', length: 100})
	actor_id: string;

	@Column({type: 'integer'})
	timestamp: number;

	@Column({type: 'text'})
	section: EventLogSection;

	@Column({type: 'text', nullable: true, length: 100})
	section_id: string | null;

	@Column({type: 'text'})
	entity_type: EventLogEntityType;

	@Column({type: 'text', nullable: true, length: 100})
	entity_id: string | null;

	@Column({type: 'text'})
	type: EventLogType;

	@Column({type: 'text', default: EventLogStatus.SUCCESS})
	status: EventLogStatus;

	@OneToMany(() => EventLogDetail, (detail) => detail.event, {cascade: true})
	details: EventLogDetail[];
}
