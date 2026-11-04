import type {MigrationInterface, QueryRunner} from 'typeorm';

export class AddUserSessionsTable1793729230712 implements MigrationInterface {
	name = 'AddUserSessionsTable1793729230712';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`
			CREATE TABLE "user_sessions" (
				"id" varchar PRIMARY KEY NOT NULL,
				"user_id" varchar NOT NULL,
				"started_at" integer NOT NULL,
				"ended_at" integer,
				"end_reason" varchar CHECK( "end_reason" IN ('replaced','signed_out','password_changed','deactivated') ),
				CONSTRAINT "CHK_user_sessions_end" CHECK (typeof("started_at") = 'integer' AND (("ended_at" IS NULL AND "end_reason" IS NULL) OR (typeof("ended_at") = 'integer' AND "end_reason" IS NOT NULL AND "ended_at" >= "started_at"))),
				CONSTRAINT "FK_e9658e959c490b0a634dfc54783" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE NO ACTION
			)
		`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_user_sessions_live_user" ON "user_sessions" ("user_id") WHERE "ended_at" IS NULL`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "IDX_user_sessions_live_user"`);
		await queryRunner.query(`DROP TABLE "user_sessions"`);
	}
}
