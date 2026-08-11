import type {MigrationInterface, QueryRunner} from 'typeorm';

export class AddAgentScheduleColumns1774580997955 implements MigrationInterface {
	name = 'AddAgentScheduleColumns1774580997955';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "temporary_agents" ("id" varchar PRIMARY KEY NOT NULL, "agent_key" text, "name" text, "description" text, "active" boolean NOT NULL DEFAULT (0), "system_message" text, "tools" text, "schedules" text NOT NULL DEFAULT ('[]'), "last_run_at" integer, "last_run_status" text, "created_at" integer NOT NULL, "updated_at" integer NOT NULL, "model" text, "schedule_kind" text NOT NULL DEFAULT ('cron'), "schedule_tz" text, CONSTRAINT "UQ_7eb05a57a66ef31126b84c571a6" UNIQUE ("agent_key"))`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_agents"("id", "agent_key", "name", "description", "active", "system_message", "tools", "schedules", "last_run_at", "last_run_status", "created_at", "updated_at", "model") SELECT "id", "agent_key", "name", "description", "active", "system_message", "tools", "schedules", "last_run_at", "last_run_status", "created_at", "updated_at", "model" FROM "agents"`,
		);
		await queryRunner.query(`DROP TABLE "agents"`);
		await queryRunner.query(`ALTER TABLE "temporary_agents" RENAME TO "agents"`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "agents" RENAME TO "temporary_agents"`);
		await queryRunner.query(
			`CREATE TABLE "agents" ("id" varchar PRIMARY KEY NOT NULL, "agent_key" text, "name" text, "description" text, "active" boolean NOT NULL DEFAULT (0), "system_message" text, "tools" text, "schedules" text NOT NULL DEFAULT ('[]'), "last_run_at" integer, "last_run_status" text, "created_at" integer NOT NULL, "updated_at" integer NOT NULL, "model" text, CONSTRAINT "UQ_7eb05a57a66ef31126b84c571a6" UNIQUE ("agent_key"))`,
		);
		await queryRunner.query(
			`INSERT INTO "agents"("id", "agent_key", "name", "description", "active", "system_message", "tools", "schedules", "last_run_at", "last_run_status", "created_at", "updated_at", "model") SELECT "id", "agent_key", "name", "description", "active", "system_message", "tools", "schedules", "last_run_at", "last_run_status", "created_at", "updated_at", "model" FROM "temporary_agents"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_agents"`);
	}
}
