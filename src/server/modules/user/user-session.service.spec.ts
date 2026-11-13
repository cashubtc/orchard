/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Vendor Dependencies */
import {TypeOrmModule} from '@nestjs/typeorm';
import {DataSource} from 'typeorm';
/* Application Dependencies */
import {migratedDatabase} from '#server/test/database';
/* Local Dependencies */
import {UserSessionService} from './user-session.service.js';
import {UserSession} from './user-session.entity.js';
import {User} from './user.entity.js';
import {UserRole, UserSessionEndReason} from './user.enums.js';
import type {VerifiedUser} from './user.types.js';

describe('UserSessionService', () => {
	let module: TestingModule;
	let userSessionService: UserSessionService;
	let data_source: DataSource;

	/** Insert a user the way the users table stores one */
	const insertUser = async (id: string): Promise<void> => {
		await data_source.query(
			`INSERT INTO "users" ("id", "name", "password_hash", "role", "active", "created_at") VALUES (?, ?, 'hash', ?, 1, 100)`,
			[id, `user-${id}`, UserRole.READER],
		);
	};

	/** Insert a session with SQL, as a writer that skips the service would */
	const insertSession = (id: string, user_id: string, ended_at: number | string | null, end_reason: string | null): Promise<unknown> =>
		data_source.query(
			`INSERT INTO "user_sessions" ("id", "user_id", "started_at", "ended_at", "end_reason") VALUES (?, ?, 100, ?, ?)`,
			[id, user_id, ended_at, end_reason],
		);

	/** Insert a live session that starts an hour from now, as one started before the clock stepped back would */
	const insertSessionStartingAhead = async (id: string, user_id: string): Promise<number> => {
		const started_at = Math.floor(Date.now() / 1000) + 3600;
		await data_source.query(`INSERT INTO "user_sessions" ("id", "user_id", "started_at") VALUES (?, ?, ?)`, [id, user_id, started_at]);
		return started_at;
	};

	/** A user whose password was checked against the hash insertUser stores */
	const verified = (id: string): VerifiedUser => ({id, password_hash: 'hash'});

	/** Every session of a user, oldest first */
	const sessionsOf = (user_id: string): Promise<UserSession[]> =>
		data_source.getRepository(UserSession).find({where: {user_id}, order: {started_at: 'ASC', ended_at: 'ASC'}});

	beforeEach(async () => {
		module = await Test.createTestingModule({
			imports: [migratedDatabase([User, UserSession]), TypeOrmModule.forFeature([UserSession])],
			providers: [UserSessionService],
		}).compile();
		userSessionService = module.get(UserSessionService);
		data_source = module.get(DataSource);
		await insertUser('alice');
		await insertUser('bob');
	});

	afterEach(async () => {
		await module.close();
	});

	describe('store', () => {
		it('rejects a second live session for the same user', async () => {
			await insertSession('s1', 'alice', null, null);

			await expect(insertSession('s2', 'alice', null, null)).rejects.toThrow(/UNIQUE constraint failed/);
			await expect(insertSession('s3', 'bob', null, null)).resolves.toBeDefined();
		});

		it('accepts ended sessions next to the live one', async () => {
			await insertSession('s1', 'alice', 200, UserSessionEndReason.REPLACED);
			await insertSession('s2', 'alice', 300, UserSessionEndReason.SIGNED_OUT);

			await expect(insertSession('s3', 'alice', null, null)).resolves.toBeDefined();
		});

		it('rejects an end time without a reason, and a reason without an end time', async () => {
			await expect(insertSession('s1', 'alice', 200, null)).rejects.toThrow(/CHECK constraint failed/);
			await expect(insertSession('s2', 'alice', null, UserSessionEndReason.SIGNED_OUT)).rejects.toThrow(/CHECK constraint failed/);
		});

		it('rejects an end reason outside the known set', async () => {
			await expect(insertSession('s1', 'alice', 200, 'expired')).rejects.toThrow(/CHECK constraint failed/);
		});

		it('rejects a session that ends before it starts', async () => {
			await expect(insertSession('s1', 'alice', 99, UserSessionEndReason.SIGNED_OUT)).rejects.toThrow(/CHECK constraint failed/);
		});

		it('rejects a start or end time that is not an integer', async () => {
			await expect(
				data_source.query(`INSERT INTO "user_sessions" ("id", "user_id", "started_at") VALUES ('s1', 'alice', 'soon')`),
			).rejects.toThrow(/CHECK constraint failed/);
			await expect(insertSession('s2', 'alice', 'later', UserSessionEndReason.SIGNED_OUT)).rejects.toThrow(/CHECK constraint failed/);
			await expect(insertSession('s3', 'alice', 200.5, UserSessionEndReason.SIGNED_OUT)).rejects.toThrow(/CHECK constraint failed/);
		});

		it('rejects a session of a user that does not exist', async () => {
			await expect(insertSession('s1', 'nobody', null, null)).rejects.toThrow(/FOREIGN KEY constraint failed/);
		});

		it('rejects un-ending an ended session when that would make a second live one', async () => {
			await insertSession('s1', 'alice', 200, UserSessionEndReason.REPLACED);
			await insertSession('s2', 'alice', null, null);

			await expect(
				data_source.query(`UPDATE "user_sessions" SET "ended_at" = NULL, "end_reason" = NULL WHERE "id" = 's1'`),
			).rejects.toThrow(/UNIQUE constraint failed/);
		});

		it("deletes a user's live and ended sessions with the user, and leaves other users' sessions", async () => {
			await insertSession('s1', 'alice', 200, UserSessionEndReason.REPLACED);
			await insertSession('s2', 'alice', null, null);
			await insertSession('s3', 'bob', null, null);

			await data_source.query(`DELETE FROM "users" WHERE "id" = 'alice'`);

			expect(await sessionsOf('alice')).toEqual([]);
			expect(await sessionsOf('bob')).toEqual([expect.objectContaining({id: 's3'})]);
		});
	});

	describe('startSession', () => {
		it('starts a live session', async () => {
			const session = await userSessionService.startSession(verified('alice'));

			expect(await sessionsOf('alice')).toEqual([
				expect.objectContaining({id: session.id, user_id: 'alice', ended_at: null, end_reason: null}),
			]);
		});

		it('ends the live session it replaces', async () => {
			const first = await userSessionService.startSession(verified('alice'));
			const second = await userSessionService.startSession(verified('alice'));

			const sessions = await sessionsOf('alice');
			expect(sessions.find((session) => session.id === first.id)).toEqual(
				expect.objectContaining({ended_at: expect.any(Number), end_reason: UserSessionEndReason.REPLACED}),
			);
			expect(sessions.filter((session) => session.ended_at === null).map((session) => session.id)).toEqual([second.id]);
		});

		it('rejects when the checked hash is no longer the stored one, and keeps the live session', async () => {
			const live = await userSessionService.startSession(verified('alice'));
			await data_source.query(`UPDATE "users" SET "password_hash" = 'changed' WHERE "id" = 'alice'`);

			await expect(userSessionService.startSession(verified('alice'))).rejects.toThrow(/Sign in again/);
			expect(await sessionsOf('alice')).toEqual([expect.objectContaining({id: live.id, ended_at: null})]);
		});

		it('keeps the live session when rejected on a manager outside a transaction', async () => {
			const live = await userSessionService.startSession(verified('alice'));
			await data_source.query(`UPDATE "users" SET "password_hash" = 'changed' WHERE "id" = 'alice'`);

			await expect(userSessionService.startSession(verified('alice'), data_source.manager)).rejects.toThrow(/Sign in again/);
			expect(await sessionsOf('alice')).toEqual([expect.objectContaining({id: live.id, ended_at: null})]);
		});

		it('rejects a deactivated user', async () => {
			await data_source.query(`UPDATE "users" SET "active" = 0 WHERE "id" = 'bob'`);

			await expect(userSessionService.startSession(verified('bob'))).rejects.toThrow(/Sign in again/);
			expect(await sessionsOf('bob')).toEqual([]);
		});
	});

	describe('endLiveSession', () => {
		it("ends the user's live session with the reason, and leaves other users' sessions live", async () => {
			const alice_session = await userSessionService.startSession(verified('alice'));
			const bob_session = await userSessionService.startSession(verified('bob'));

			await userSessionService.endLiveSession('alice', UserSessionEndReason.DEACTIVATED);

			expect(await sessionsOf('alice')).toEqual([
				expect.objectContaining({id: alice_session.id, end_reason: UserSessionEndReason.DEACTIVATED}),
			]);
			expect(await sessionsOf('bob')).toEqual([expect.objectContaining({id: bob_session.id, ended_at: null})]);
		});

		it('rejects a missing user id instead of ending every live session', async () => {
			await userSessionService.startSession(verified('alice'));

			await expect(userSessionService.endLiveSession(undefined, UserSessionEndReason.DEACTIVATED)).rejects.toThrow(/user_id/);
			expect(await sessionsOf('alice')).toEqual([expect.objectContaining({ended_at: null})]);
		});

		it('ends a session that started after the current time, at its start', async () => {
			const started_at = await insertSessionStartingAhead('ahead', 'alice');

			await userSessionService.endLiveSession('alice', UserSessionEndReason.DEACTIVATED);

			expect(await sessionsOf('alice')).toEqual([
				expect.objectContaining({id: 'ahead', ended_at: started_at, end_reason: UserSessionEndReason.DEACTIVATED}),
			]);
		});
	});

	describe('signOut', () => {
		it('ends the live session', async () => {
			const session = await userSessionService.startSession(verified('alice'));

			await expect(userSessionService.signOut(session.id, 'alice')).resolves.toBe(true);
			expect(await sessionsOf('alice')).toEqual([expect.objectContaining({end_reason: UserSessionEndReason.SIGNED_OUT})]);
		});

		it('returns false for an ended session and keeps its first end reason', async () => {
			const first = await userSessionService.startSession(verified('alice'));
			await userSessionService.startSession(verified('alice'));

			await expect(userSessionService.signOut(first.id, 'alice')).resolves.toBe(false);
			const sessions = await sessionsOf('alice');
			expect(sessions.find((session) => session.id === first.id).end_reason).toBe(UserSessionEndReason.REPLACED);
		});

		it('returns false for a session of another user', async () => {
			const session = await userSessionService.startSession(verified('alice'));

			await expect(userSessionService.signOut(session.id, 'bob')).resolves.toBe(false);
			expect(await sessionsOf('alice')).toEqual([expect.objectContaining({ended_at: null})]);
		});

		it('ends a session that started after the current time', async () => {
			await insertSessionStartingAhead('ahead', 'alice');

			await expect(userSessionService.signOut('ahead', 'alice')).resolves.toBe(true);
			expect(await sessionsOf('alice')).toEqual([expect.objectContaining({end_reason: UserSessionEndReason.SIGNED_OUT})]);
		});
	});

	describe('getLiveSessionUser', () => {
		it('returns the stored user of a live session', async () => {
			const session = await userSessionService.startSession(verified('alice'));

			await expect(userSessionService.getLiveSessionUser(session.id, 'alice')).resolves.toEqual(
				expect.objectContaining({id: 'alice', name: 'user-alice'}),
			);
		});

		it('returns null once the session has ended', async () => {
			const session = await userSessionService.startSession(verified('alice'));
			await userSessionService.signOut(session.id, 'alice');

			await expect(userSessionService.getLiveSessionUser(session.id, 'alice')).resolves.toBeNull();
		});

		it('returns null for a session of another user', async () => {
			const session = await userSessionService.startSession(verified('alice'));

			await expect(userSessionService.getLiveSessionUser(session.id, 'bob')).resolves.toBeNull();
		});

		it('rejects a missing session id instead of matching any live session of the user', async () => {
			await userSessionService.startSession(verified('alice'));

			await expect(userSessionService.getLiveSessionUser(undefined, 'alice')).rejects.toThrow(/session_id/);
		});
	});
});
