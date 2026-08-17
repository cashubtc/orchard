import type {MigrationInterface, QueryRunner} from 'typeorm';

export class AddUniqueTelegramChatId1773716740605 implements MigrationInterface {
	name = 'AddUniqueTelegramChatId1773716740605';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "IDX_0890d8ebe90990c78fe4804231"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_users" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar(50) NOT NULL, "password_hash" varchar(60) NOT NULL, "role" text NOT NULL DEFAULT ('reader'), "active" boolean NOT NULL DEFAULT (1), "label" text(100), "created_at" integer NOT NULL, "telegram_chat_id" text, CONSTRAINT "UQ_51b8b26ac168fbe7d6f5653e6cf" UNIQUE ("name"))`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_users"("id", "name", "password_hash", "role", "active", "label", "created_at", "telegram_chat_id") SELECT "id", "name", "password_hash", "role", "active", "label", "created_at", "telegram_chat_id" FROM "users"`,
		);
		await queryRunner.query(`DROP TABLE "users"`);
		await queryRunner.query(`ALTER TABLE "temporary_users" RENAME TO "users"`);
		await queryRunner.query(`CREATE INDEX "IDX_0890d8ebe90990c78fe4804231" ON "users" ("active") `);
		await queryRunner.query(`DROP INDEX "IDX_0890d8ebe90990c78fe4804231"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_users" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar(50) NOT NULL, "password_hash" varchar(60) NOT NULL, "role" text NOT NULL DEFAULT ('reader'), "active" boolean NOT NULL DEFAULT (1), "label" text(100), "created_at" integer NOT NULL, "telegram_chat_id" text, CONSTRAINT "UQ_51b8b26ac168fbe7d6f5653e6cf" UNIQUE ("name"), CONSTRAINT "UQ_318d0111781e5eba94bf57ec66a" UNIQUE ("telegram_chat_id"))`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_users"("id", "name", "password_hash", "role", "active", "label", "created_at", "telegram_chat_id") SELECT "id", "name", "password_hash", "role", "active", "label", "created_at", "telegram_chat_id" FROM "users"`,
		);
		await queryRunner.query(`DROP TABLE "users"`);
		await queryRunner.query(`ALTER TABLE "temporary_users" RENAME TO "users"`);
		await queryRunner.query(`CREATE INDEX "IDX_0890d8ebe90990c78fe4804231" ON "users" ("active") `);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "IDX_0890d8ebe90990c78fe4804231"`);
		await queryRunner.query(`ALTER TABLE "users" RENAME TO "temporary_users"`);
		await queryRunner.query(
			`CREATE TABLE "users" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar(50) NOT NULL, "password_hash" varchar(60) NOT NULL, "role" text NOT NULL DEFAULT ('reader'), "active" boolean NOT NULL DEFAULT (1), "label" text(100), "created_at" integer NOT NULL, "telegram_chat_id" text, CONSTRAINT "UQ_51b8b26ac168fbe7d6f5653e6cf" UNIQUE ("name"))`,
		);
		await queryRunner.query(
			`INSERT INTO "users"("id", "name", "password_hash", "role", "active", "label", "created_at", "telegram_chat_id") SELECT "id", "name", "password_hash", "role", "active", "label", "created_at", "telegram_chat_id" FROM "temporary_users"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_users"`);
		await queryRunner.query(`CREATE INDEX "IDX_0890d8ebe90990c78fe4804231" ON "users" ("active") `);
		await queryRunner.query(`DROP INDEX "IDX_0890d8ebe90990c78fe4804231"`);
		await queryRunner.query(`ALTER TABLE "users" RENAME TO "temporary_users"`);
		await queryRunner.query(
			`CREATE TABLE "users" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar(50) NOT NULL, "password_hash" varchar(60) NOT NULL, "role" text NOT NULL DEFAULT ('reader'), "active" boolean NOT NULL DEFAULT (1), "label" text(100), "created_at" integer NOT NULL, "telegram_chat_id" text, CONSTRAINT "UQ_51b8b26ac168fbe7d6f5653e6cf" UNIQUE ("name"))`,
		);
		await queryRunner.query(
			`INSERT INTO "users"("id", "name", "password_hash", "role", "active", "label", "created_at", "telegram_chat_id") SELECT "id", "name", "password_hash", "role", "active", "label", "created_at", "telegram_chat_id" FROM "temporary_users"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_users"`);
		await queryRunner.query(`CREATE INDEX "IDX_0890d8ebe90990c78fe4804231" ON "users" ("active") `);
	}
}
