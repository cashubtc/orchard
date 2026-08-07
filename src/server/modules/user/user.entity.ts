/* Vendor Dependencies */
import {Entity, Column, PrimaryGeneratedColumn, Index} from 'typeorm';
/* Local Dependencies */
import {UserRole} from './user.enums';

@Entity('users')
export class User {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({type: 'varchar', unique: true, length: 50})
	name: string;

	@Column({type: 'varchar', length: 60})
	password_hash: string;

	@Column({
		type: 'text',
		default: UserRole.READER,
	})
	role: UserRole;

	@Column({type: 'boolean', default: true})
	@Index()
	active: boolean;

	@Column({type: 'text', nullable: true, length: 100})
	label: string | null;

	@Column({type: 'text', nullable: true, unique: true})
	telegram_chat_id: string | null;

	@Column({type: 'integer'})
	created_at: number;
}
