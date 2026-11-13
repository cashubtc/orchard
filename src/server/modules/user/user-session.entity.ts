/* Vendor Dependencies */
import {Entity, Column, PrimaryGeneratedColumn, Index, Check, ManyToOne, JoinColumn, type Relation} from 'typeorm';
/* Local Dependencies */
import {User} from './user.entity.js';
import {UserSessionEndReason} from './user.enums.js';

/**
 * One sign-in of a user. The session's access and refresh tokens carry its id and work only while it is live.
 * The table holds the session invariants for every writer:
 * - a user has one live session at most (IDX_user_sessions_live_user)
 * - a live session has no end, and an ended session has both an end time and a reason (CHK_user_sessions_end)
 * - a session ends at or after its start (CHK_user_sessions_end)
 * - both times are integers, because SQLite would store text here and sort it above every number (CHK_user_sessions_end)
 * - the reason is one of UserSessionEndReason (the column's CHECK)
 * - a session belongs to an existing user, and deleting the user deletes its sessions (the foreign key)
 */
@Entity('user_sessions')
@Index('IDX_user_sessions_live_user', ['user_id'], {unique: true, where: '"ended_at" IS NULL'})
@Check(
	'CHK_user_sessions_end',
	`typeof("started_at") = 'integer' AND (("ended_at" IS NULL AND "end_reason" IS NULL) OR (typeof("ended_at") = 'integer' AND "end_reason" IS NOT NULL AND "ended_at" >= "started_at"))`,
)
export class UserSession {
	@PrimaryGeneratedColumn('uuid')
	id: string;

	@Column({type: 'varchar'})
	user_id: string;

	// A migration's down that rebuilds users deletes every session: TypeORM reverts with foreign keys still on
	@ManyToOne(() => User, {nullable: false, onDelete: 'CASCADE'})
	@JoinColumn({name: 'user_id'})
	user: Relation<User>;

	@Column({type: 'integer'})
	started_at: number;

	@Column({type: 'integer', nullable: true})
	ended_at: number | null; // null while the session is live

	@Column({type: 'simple-enum', enum: UserSessionEndReason, nullable: true})
	end_reason: UserSessionEndReason | null; // null while the session is live
}
