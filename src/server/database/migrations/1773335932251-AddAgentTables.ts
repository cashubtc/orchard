import type {MigrationInterface, QueryRunner} from 'typeorm';

export class AddAgentTables1773335932251 implements MigrationInterface {
	name = 'AddAgentTables1773335932251';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "agent_runs" ("id" varchar PRIMARY KEY NOT NULL, "status" text NOT NULL, "schedule_trigger" text, "started_at" integer NOT NULL, "completed_at" integer, "result" text, "error" text, "tokens_used" integer, "notified" boolean NOT NULL DEFAULT (0), "agent_id" varchar)`,
		);
		await queryRunner.query(`CREATE INDEX "IDX_agent_runs_notified" ON "agent_runs" ("notified") `);
		await queryRunner.query(`CREATE INDEX "IDX_agent_runs_agent_started" ON "agent_runs" ("agent_id", "started_at") `);
		await queryRunner.query(
			`CREATE TABLE "agents" ("id" varchar PRIMARY KEY NOT NULL, "agent_key" text, "name" text NOT NULL, "description" text, "active" boolean NOT NULL DEFAULT (0), "system_message" text, "tools" text, "schedules" text NOT NULL DEFAULT ('[]'), "last_run_at" integer, "last_run_status" text, "created_at" integer NOT NULL, "updated_at" integer NOT NULL, "model" text, CONSTRAINT "UQ_7eb05a57a66ef31126b84c571a6" UNIQUE ("agent_key"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "conversations" ("id" varchar PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "chat_id" text NOT NULL, "status" text NOT NULL DEFAULT ('active'), "messages" text NOT NULL DEFAULT ('[]'), "tokens_used" integer NOT NULL DEFAULT (0), "created_at" integer NOT NULL, "last_activity_at" integer NOT NULL, "source_agent_id" varchar)`,
		);
		await queryRunner.query(`CREATE INDEX "IDX_conversations_status_activity" ON "conversations" ("status", "last_activity_at") `);
		await queryRunner.query(`CREATE INDEX "IDX_conversations_chat_status" ON "conversations" ("chat_id", "status") `);
		await queryRunner.query(`DROP INDEX "IDX_agent_runs_notified"`);
		await queryRunner.query(`DROP INDEX "IDX_agent_runs_agent_started"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_agent_runs" ("id" varchar PRIMARY KEY NOT NULL, "status" text NOT NULL, "schedule_trigger" text, "started_at" integer NOT NULL, "completed_at" integer, "result" text, "error" text, "tokens_used" integer, "notified" boolean NOT NULL DEFAULT (0), "agent_id" varchar, CONSTRAINT "FK_b7e54bda53308d1c35f163440b7" FOREIGN KEY ("agent_id") REFERENCES "agents" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_agent_runs"("id", "status", "schedule_trigger", "started_at", "completed_at", "result", "error", "tokens_used", "notified", "agent_id") SELECT "id", "status", "schedule_trigger", "started_at", "completed_at", "result", "error", "tokens_used", "notified", "agent_id" FROM "agent_runs"`,
		);
		await queryRunner.query(`DROP TABLE "agent_runs"`);
		await queryRunner.query(`ALTER TABLE "temporary_agent_runs" RENAME TO "agent_runs"`);
		await queryRunner.query(`CREATE INDEX "IDX_agent_runs_notified" ON "agent_runs" ("notified") `);
		await queryRunner.query(`CREATE INDEX "IDX_agent_runs_agent_started" ON "agent_runs" ("agent_id", "started_at") `);
		await queryRunner.query(`DROP INDEX "IDX_conversations_status_activity"`);
		await queryRunner.query(`DROP INDEX "IDX_conversations_chat_status"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_conversations" ("id" varchar PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "chat_id" text NOT NULL, "status" text NOT NULL DEFAULT ('active'), "messages" text NOT NULL DEFAULT ('[]'), "tokens_used" integer NOT NULL DEFAULT (0), "created_at" integer NOT NULL, "last_activity_at" integer NOT NULL, "source_agent_id" varchar, CONSTRAINT "FK_8d671cfc49573daded929ed7678" FOREIGN KEY ("source_agent_id") REFERENCES "agents" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_conversations"("id", "user_id", "chat_id", "status", "messages", "tokens_used", "created_at", "last_activity_at", "source_agent_id") SELECT "id", "user_id", "chat_id", "status", "messages", "tokens_used", "created_at", "last_activity_at", "source_agent_id" FROM "conversations"`,
		);
		await queryRunner.query(`DROP TABLE "conversations"`);
		await queryRunner.query(`ALTER TABLE "temporary_conversations" RENAME TO "conversations"`);
		await queryRunner.query(`CREATE INDEX "IDX_conversations_status_activity" ON "conversations" ("status", "last_activity_at") `);
		await queryRunner.query(`CREATE INDEX "IDX_conversations_chat_status" ON "conversations" ("chat_id", "status") `);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "IDX_conversations_chat_status"`);
		await queryRunner.query(`DROP INDEX "IDX_conversations_status_activity"`);
		await queryRunner.query(`ALTER TABLE "conversations" RENAME TO "temporary_conversations"`);
		await queryRunner.query(
			`CREATE TABLE "conversations" ("id" varchar PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "chat_id" text NOT NULL, "status" text NOT NULL DEFAULT ('active'), "messages" text NOT NULL DEFAULT ('[]'), "tokens_used" integer NOT NULL DEFAULT (0), "created_at" integer NOT NULL, "last_activity_at" integer NOT NULL, "source_agent_id" varchar)`,
		);
		await queryRunner.query(
			`INSERT INTO "conversations"("id", "user_id", "chat_id", "status", "messages", "tokens_used", "created_at", "last_activity_at", "source_agent_id") SELECT "id", "user_id", "chat_id", "status", "messages", "tokens_used", "created_at", "last_activity_at", "source_agent_id" FROM "temporary_conversations"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_conversations"`);
		await queryRunner.query(`CREATE INDEX "IDX_conversations_chat_status" ON "conversations" ("chat_id", "status") `);
		await queryRunner.query(`CREATE INDEX "IDX_conversations_status_activity" ON "conversations" ("status", "last_activity_at") `);
		await queryRunner.query(`DROP INDEX "IDX_agent_runs_agent_started"`);
		await queryRunner.query(`DROP INDEX "IDX_agent_runs_notified"`);
		await queryRunner.query(`ALTER TABLE "agent_runs" RENAME TO "temporary_agent_runs"`);
		await queryRunner.query(
			`CREATE TABLE "agent_runs" ("id" varchar PRIMARY KEY NOT NULL, "status" text NOT NULL, "schedule_trigger" text, "started_at" integer NOT NULL, "completed_at" integer, "result" text, "error" text, "tokens_used" integer, "notified" boolean NOT NULL DEFAULT (0), "agent_id" varchar)`,
		);
		await queryRunner.query(
			`INSERT INTO "agent_runs"("id", "status", "schedule_trigger", "started_at", "completed_at", "result", "error", "tokens_used", "notified", "agent_id") SELECT "id", "status", "schedule_trigger", "started_at", "completed_at", "result", "error", "tokens_used", "notified", "agent_id" FROM "temporary_agent_runs"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_agent_runs"`);
		await queryRunner.query(`CREATE INDEX "IDX_agent_runs_agent_started" ON "agent_runs" ("agent_id", "started_at") `);
		await queryRunner.query(`CREATE INDEX "IDX_agent_runs_notified" ON "agent_runs" ("notified") `);
		await queryRunner.query(`DROP INDEX "IDX_conversations_chat_status"`);
		await queryRunner.query(`DROP INDEX "IDX_conversations_status_activity"`);
		await queryRunner.query(`DROP TABLE "conversations"`);
		await queryRunner.query(`DROP TABLE "agents"`);
		await queryRunner.query(`DROP INDEX "IDX_agent_runs_agent_started"`);
		await queryRunner.query(`DROP INDEX "IDX_agent_runs_notified"`);
		await queryRunner.query(`DROP TABLE "agent_runs"`);
	}
}
