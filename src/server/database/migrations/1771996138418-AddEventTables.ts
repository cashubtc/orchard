import type {MigrationInterface, QueryRunner} from 'typeorm';

export class AddEventTables1771996138418 implements MigrationInterface {
	name = 'AddEventTables1771996138418';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "event_details" ("id" varchar PRIMARY KEY NOT NULL, "field" text(100) NOT NULL, "old_value" text, "new_value" text, "status" text NOT NULL DEFAULT ('success'), "error_code" text(50), "error_message" text(500), "event_id" varchar)`,
		);
		await queryRunner.query(
			`CREATE TABLE "events" ("id" varchar PRIMARY KEY NOT NULL, "actor_type" text NOT NULL, "actor_id" text(100) NOT NULL, "timestamp" integer NOT NULL, "section" text NOT NULL, "section_id" text(100), "entity_type" text NOT NULL, "entity_id" text(100), "type" text NOT NULL, "status" text NOT NULL DEFAULT ('success'))`,
		);
		await queryRunner.query(
			`CREATE TABLE "temporary_event_details" ("id" varchar PRIMARY KEY NOT NULL, "field" text(100) NOT NULL, "old_value" text, "new_value" text, "status" text NOT NULL DEFAULT ('success'), "error_code" text(50), "error_message" text(500), "event_id" varchar, CONSTRAINT "FK_c760e9ad9dbcc99f55b5a858775" FOREIGN KEY ("event_id") REFERENCES "events" ("id") ON DELETE CASCADE ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_event_details"("id", "field", "old_value", "new_value", "status", "error_code", "error_message", "event_id") SELECT "id", "field", "old_value", "new_value", "status", "error_code", "error_message", "event_id" FROM "event_details"`,
		);
		await queryRunner.query(`DROP TABLE "event_details"`);
		await queryRunner.query(`ALTER TABLE "temporary_event_details" RENAME TO "event_details"`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "event_details" RENAME TO "temporary_event_details"`);
		await queryRunner.query(
			`CREATE TABLE "event_details" ("id" varchar PRIMARY KEY NOT NULL, "field" text(100) NOT NULL, "old_value" text, "new_value" text, "status" text NOT NULL DEFAULT ('success'), "error_code" text(50), "error_message" text(500), "event_id" varchar)`,
		);
		await queryRunner.query(
			`INSERT INTO "event_details"("id", "field", "old_value", "new_value", "status", "error_code", "error_message", "event_id") SELECT "id", "field", "old_value", "new_value", "status", "error_code", "error_message", "event_id" FROM "temporary_event_details"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_event_details"`);
		await queryRunner.query(`DROP TABLE "events"`);
		await queryRunner.query(`DROP TABLE "event_details"`);
	}
}
