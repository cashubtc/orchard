/* Core Dependencies */
import {Injectable} from '@nestjs/common';
import {InjectRepository} from '@nestjs/typeorm';
import {randomUUID} from 'crypto';
/* Vendor Dependencies */
import {Repository, IsNull, type EntityManager, type FindOptionsWhere} from 'typeorm';
import {DateTime} from 'luxon';
/* Local Dependencies */
import {UserSession} from './user-session.entity.js';
import type {User} from './user.entity.js';
import {UserSessionEndReason} from './user.enums.js';
import type {VerifiedUser} from './user.types.js';
import {requireId} from './user.helpers.js';

/**
 * The only writer of user_sessions. Each update changes a live session only,
 * so an ended session stays ended until deleting its user deletes it.
 * Each method rejects a missing id first, because TypeORM would drop it from the where object (see requireId).
 */
@Injectable()
export class UserSessionService {
	constructor(
		@InjectRepository(UserSession)
		private userSessionRepository: Repository<UserSession>,
	) {}

	/**
	 * Start a session for a user whose password was just checked, ending the live session it replaces.
	 * The insert re-checks the users row in the same statement: the user must still be active and still have the hash
	 * the password was checked against, so a deactivation or password change that lands during the check rejects the sign-in.
	 * @param {VerifiedUser} verified - The user, with the password hash the password was checked against
	 * @param {EntityManager} manager - Transaction to write in, when the session starts with other writes
	 * @returns {Promise<Pick<UserSession, 'id'>>} The id of the new live session
	 */
	public async startSession(verified: VerifiedUser, manager?: EntityManager): Promise<Pick<UserSession, 'id'>> {
		requireId(verified.id, 'user_id');
		// Always a transaction, so a rejected insert undoes the end of the replaced session. Inside a caller's transaction this is a savepoint
		return (manager ?? this.userSessionRepository.manager).transaction((transaction) => this.writeSession(verified, transaction));
	}

	/**
	 * End a user's live session, if it has one
	 * @param {string} user_id - The id of the user
	 * @param {UserSessionEndReason} end_reason - Why the session ends
	 * @param {EntityManager} manager - Transaction to write in, when the session ends with other writes
	 * @returns {Promise<void>}
	 */
	public async endLiveSession(user_id: string, end_reason: UserSessionEndReason, manager?: EntityManager): Promise<void> {
		requireId(user_id, 'user_id');
		await this.endLiveSessions({user_id}, end_reason, manager ?? this.userSessionRepository.manager);
	}

	/**
	 * End a live session because its user signed out
	 * @param {string} session_id - The id of the session
	 * @param {string} user_id - The id of the user the session must belong to
	 * @returns {Promise<boolean>} False when the session had already ended or belongs to another user
	 */
	public async signOut(session_id: string, user_id: string): Promise<boolean> {
		requireId(session_id, 'session_id');
		requireId(user_id, 'user_id');
		const ended = await this.endLiveSessions(
			{id: session_id, user_id},
			UserSessionEndReason.SIGNED_OUT,
			this.userSessionRepository.manager,
		);
		return ended === 1;
	}

	/**
	 * Load the user of a live session
	 * @param {string} session_id - The id of the session
	 * @param {string} user_id - The id of the user the session must belong to
	 * @returns {Promise<User | null>} The stored user, or null when the session has ended or belongs to another user
	 */
	public async getLiveSessionUser(session_id: string, user_id: string): Promise<User | null> {
		requireId(session_id, 'session_id');
		requireId(user_id, 'user_id');
		const session = await this.userSessionRepository.findOne({
			where: {id: session_id, user_id, ended_at: IsNull()},
			relations: {user: true},
		});
		return session?.user ?? null;
	}

	/**
	 * End the user's live session and insert the new one. Throws when the insert is rejected, so the transaction undoes the end
	 * @param {VerifiedUser} verified - The user, with the password hash the password was checked against
	 * @param {EntityManager} manager - The transaction to write in
	 * @returns {Promise<Pick<UserSession, 'id'>>} The id of the new live session
	 */
	private async writeSession(verified: VerifiedUser, manager: EntityManager): Promise<Pick<UserSession, 'id'>> {
		await this.endLiveSession(verified.id, UserSessionEndReason.REPLACED, manager);
		// RETURNING makes query() hand back the inserted rows. A plain INSERT returns the last rowid, not a count
		const inserted: Pick<UserSession, 'id'>[] = await manager.query(
			`INSERT INTO "user_sessions" ("id", "user_id", "started_at")
			SELECT ?, "id", ? FROM "users" WHERE "id" = ? AND "active" = 1 AND "password_hash" = ?
			RETURNING "id"`,
			[randomUUID(), this.now(), verified.id, verified.password_hash],
		);
		if (inserted.length !== 1) {
			throw new Error(
				'Session not started: the user was deactivated, deleted or changed their password during sign-in. Sign in again',
			);
		}
		return inserted[0];
	}

	/**
	 * End the live sessions that match, at the current time but never before a session's start.
	 * A clock that stepped back behind a session's start would otherwise fail CHK_user_sessions_end,
	 * and the session could not end until the clock caught up.
	 * @param {FindOptionsWhere<UserSession>} where - Which sessions, before the live-only condition is added
	 * @param {UserSessionEndReason} end_reason - Why the sessions end
	 * @param {EntityManager} manager - The manager to write with
	 * @returns {Promise<number>} The number of sessions ended
	 */
	private async endLiveSessions(
		where: FindOptionsWhere<UserSession>,
		end_reason: UserSessionEndReason,
		manager: EntityManager,
	): Promise<number> {
		const result = await manager
			.createQueryBuilder()
			.update(UserSession)
			.set({ended_at: () => 'MAX("started_at", :now)', end_reason})
			.where({...where, ended_at: IsNull()})
			.setParameters({now: this.now()})
			.execute();
		return result.affected;
	}

	/**
	 * The current time in Unix seconds, the unit of every timestamp column
	 * @returns {number} Seconds since the epoch
	 */
	private now(): number {
		return Math.floor(DateTime.now().toSeconds());
	}
}
