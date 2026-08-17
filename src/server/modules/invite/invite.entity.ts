/* Vendor Dependencies */
import {Entity, Column, PrimaryGeneratedColumn, Index, ManyToOne, OneToOne, JoinColumn, type Relation} from 'typeorm';
/* Application Dependencies */
import {UserRole} from '#server/modules/user/user.enums';
import {User} from '#server/modules/user/user.entity';

@Entity('invites')
@Index(['used_at', 'expires_at'])
export class Invite {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({type: 'varchar', unique: true, length: 12})
	token: string; // unique 8-char invite code

	@Column({type: 'text', nullable: true, length: 100})
	label: string | null; // suggested label at time of invite creation

	@Column({type: 'text', default: UserRole.READER})
	role: UserRole; // role to assign when claimed

	@ManyToOne(() => User, {onDelete: 'RESTRICT'})
	@JoinColumn({name: 'created_by_id'})
	created_by: Relation<User>; // admin who created the invite

	@OneToOne(() => User, {nullable: true, onDelete: 'SET NULL'})
	@JoinColumn({name: 'claimed_by_id'})
	claimed_by: Relation<User> | null; // user who claimed the invite

	@Column({type: 'integer', nullable: true})
	used_at: number | null; // when the invite was claimed

	@Column({type: 'integer', nullable: true})
	expires_at: number | null; // optional expiration date

	@Column({type: 'integer'})
	created_at: number;
}
