/* Vendor Dependencies */
import {Entity, Column, PrimaryGeneratedColumn, ManyToOne, JoinColumn, type Relation} from 'typeorm';
/* Local Dependencies */
import {EventLogDetailStatus} from './event.enums';
import {EventLog} from './event.entity';

@Entity('event_details')
export class EventLogDetail {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@ManyToOne(() => EventLog, (event) => event.details, {onDelete: 'CASCADE'})
	@JoinColumn({name: 'event_id'})
	event: Relation<EventLog>;

	@Column({type: 'text', length: 100})
	field: string;

	@Column({type: 'text', nullable: true})
	old_value: string | null;

	@Column({type: 'text', nullable: true})
	new_value: string | null;

	@Column({type: 'text', default: EventLogDetailStatus.SUCCESS})
	status: EventLogDetailStatus;

	@Column({type: 'text', nullable: true, length: 50})
	error_code: string | null;

	@Column({type: 'text', nullable: true, length: 500})
	error_message: string | null;
}
