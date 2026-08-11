import type {MigrationInterface, QueryRunner} from 'typeorm';

export class AddUserRoleColumn1762197985439 implements MigrationInterface {
	name = 'AddUserRoleColumn1762197985439';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "IDX_b1096b9f73b49497a8c8d460ed"`);
		await queryRunner.query(`DROP INDEX "IDX_0890d8ebe90990c78fe4804231"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_users" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar(50) NOT NULL, "password_hash" varchar(60) NOT NULL, "role" text NOT NULL DEFAULT ('reader'), "active" boolean NOT NULL DEFAULT (1), "label" text(100), "created_at" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_51b8b26ac168fbe7d6f5653e6cf" UNIQUE ("name"))`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_users"("id", "name", "password_hash", "role", "active", "label", "created_at") SELECT "id", "name", "password_hash", "role", "active", "label", "created_at" FROM "users"`,
		);
		await queryRunner.query(`DROP TABLE "users"`);
		await queryRunner.query(`ALTER TABLE "temporary_users" RENAME TO "users"`);
		await queryRunner.query(`CREATE INDEX "IDX_0890d8ebe90990c78fe4804231" ON "users" ("active") `);
		await queryRunner.query(
			`CREATE TABLE "temporary_invites" ("id" varchar PRIMARY KEY NOT NULL, "token" varchar(8) NOT NULL, "label" text(100), "role" text NOT NULL DEFAULT ('reader'), "used_at" datetime, "expires_at" datetime, "created_at" datetime NOT NULL DEFAULT (datetime('now')), "created_by_id" varchar, "claimed_by_id" varchar, CONSTRAINT "REL_dff9ddfbc2b5b9a172dcb8549b" UNIQUE ("claimed_by_id"), CONSTRAINT "UQ_18a9a6c85f7cc6f42ebef3b3188" UNIQUE ("token"), CONSTRAINT "FK_dff9ddfbc2b5b9a172dcb8549b2" FOREIGN KEY ("claimed_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_5e2a07492128e96a16b3fdcf9a0" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_invites"("id", "token", "label", "role", "used_at", "expires_at", "created_at", "created_by_id", "claimed_by_id") SELECT "id", "token", "label", "role", "used_at", "expires_at", "created_at", "created_by_id", "claimed_by_id" FROM "invites"`,
		);
		await queryRunner.query(`DROP TABLE "invites"`);
		await queryRunner.query(`ALTER TABLE "temporary_invites" RENAME TO "invites"`);
		await queryRunner.query(`DROP INDEX "IDX_0890d8ebe90990c78fe4804231"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_users" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar(50) NOT NULL, "password_hash" varchar(60) NOT NULL, "role" text NOT NULL DEFAULT ('reader'), "active" boolean NOT NULL DEFAULT (1), "label" text(100), "created_at" integer NOT NULL, CONSTRAINT "UQ_51b8b26ac168fbe7d6f5653e6cf" UNIQUE ("name"))`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_users"("id", "name", "password_hash", "role", "active", "label", "created_at") SELECT "id", "name", "password_hash", "role", "active", "label", "created_at" FROM "users"`,
		);
		await queryRunner.query(`DROP TABLE "users"`);
		await queryRunner.query(`ALTER TABLE "temporary_users" RENAME TO "users"`);
		await queryRunner.query(`CREATE INDEX "IDX_0890d8ebe90990c78fe4804231" ON "users" ("active") `);
		await queryRunner.query(
			`CREATE TABLE "temporary_invites" ("id" varchar PRIMARY KEY NOT NULL, "token" varchar(12) NOT NULL, "label" text(100), "role" text NOT NULL DEFAULT ('reader'), "used_at" integer, "expires_at" integer, "created_at" integer NOT NULL, "created_by_id" varchar, "claimed_by_id" varchar, CONSTRAINT "REL_dff9ddfbc2b5b9a172dcb8549b" UNIQUE ("claimed_by_id"), CONSTRAINT "UQ_18a9a6c85f7cc6f42ebef3b3188" UNIQUE ("token"), CONSTRAINT "FK_dff9ddfbc2b5b9a172dcb8549b2" FOREIGN KEY ("claimed_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_5e2a07492128e96a16b3fdcf9a0" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_invites"("id", "token", "label", "role", "used_at", "expires_at", "created_at", "created_by_id", "claimed_by_id") SELECT "id", "token", "label", "role", "used_at", "expires_at", "created_at", "created_by_id", "claimed_by_id" FROM "invites"`,
		);
		await queryRunner.query(`DROP TABLE "invites"`);
		await queryRunner.query(`ALTER TABLE "temporary_invites" RENAME TO "invites"`);
		await queryRunner.query(`CREATE INDEX "IDX_3a3786cc79cd8f798b2b163314" ON "invites" ("used_at", "expires_at") `);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "IDX_3a3786cc79cd8f798b2b163314"`);
		await queryRunner.query(`ALTER TABLE "invites" RENAME TO "temporary_invites"`);
		await queryRunner.query(
			`CREATE TABLE "invites" ("id" varchar PRIMARY KEY NOT NULL, "token" varchar(8) NOT NULL, "label" text(100), "role" text NOT NULL DEFAULT ('reader'), "used_at" datetime, "expires_at" datetime, "created_at" datetime NOT NULL DEFAULT (datetime('now')), "created_by_id" varchar, "claimed_by_id" varchar, CONSTRAINT "REL_dff9ddfbc2b5b9a172dcb8549b" UNIQUE ("claimed_by_id"), CONSTRAINT "UQ_18a9a6c85f7cc6f42ebef3b3188" UNIQUE ("token"), CONSTRAINT "FK_dff9ddfbc2b5b9a172dcb8549b2" FOREIGN KEY ("claimed_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_5e2a07492128e96a16b3fdcf9a0" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "invites"("id", "token", "label", "role", "used_at", "expires_at", "created_at", "created_by_id", "claimed_by_id") SELECT "id", "token", "label", "role", "used_at", "expires_at", "created_at", "created_by_id", "claimed_by_id" FROM "temporary_invites"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_invites"`);
		await queryRunner.query(`DROP INDEX "IDX_0890d8ebe90990c78fe4804231"`);
		await queryRunner.query(`ALTER TABLE "users" RENAME TO "temporary_users"`);
		await queryRunner.query(
			`CREATE TABLE "users" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar(50) NOT NULL, "password_hash" varchar(60) NOT NULL, "role" text NOT NULL DEFAULT ('reader'), "active" boolean NOT NULL DEFAULT (1), "label" text(100), "created_at" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_51b8b26ac168fbe7d6f5653e6cf" UNIQUE ("name"))`,
		);
		await queryRunner.query(
			`INSERT INTO "users"("id", "name", "password_hash", "role", "active", "label", "created_at") SELECT "id", "name", "password_hash", "role", "active", "label", "created_at" FROM "temporary_users"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_users"`);
		await queryRunner.query(`CREATE INDEX "IDX_0890d8ebe90990c78fe4804231" ON "users" ("active") `);
		await queryRunner.query(`ALTER TABLE "invites" RENAME TO "temporary_invites"`);
		await queryRunner.query(
			`CREATE TABLE "invites" ("id" varchar PRIMARY KEY NOT NULL, "token" varchar(8) NOT NULL, "label" text(100), "role" text NOT NULL DEFAULT ('reader'), "used" boolean NOT NULL DEFAULT (0), "used_at" datetime, "expires_at" datetime, "created_at" datetime NOT NULL DEFAULT (datetime('now')), "created_by_id" varchar, "claimed_by_id" varchar, CONSTRAINT "REL_dff9ddfbc2b5b9a172dcb8549b" UNIQUE ("claimed_by_id"), CONSTRAINT "UQ_18a9a6c85f7cc6f42ebef3b3188" UNIQUE ("token"), CONSTRAINT "FK_dff9ddfbc2b5b9a172dcb8549b2" FOREIGN KEY ("claimed_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE NO ACTION, CONSTRAINT "FK_5e2a07492128e96a16b3fdcf9a0" FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE RESTRICT ON UPDATE NO ACTION)`,
		);
		await queryRunner.query(
			`INSERT INTO "invites"("id", "token", "label", "role", "used_at", "expires_at", "created_at", "created_by_id", "claimed_by_id") SELECT "id", "token", "label", "role", "used_at", "expires_at", "created_at", "created_by_id", "claimed_by_id" FROM "temporary_invites"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_invites"`);
		await queryRunner.query(`DROP INDEX "IDX_0890d8ebe90990c78fe4804231"`);
		await queryRunner.query(`ALTER TABLE "users" RENAME TO "temporary_users"`);
		await queryRunner.query(
			`CREATE TABLE "users" ("id" varchar PRIMARY KEY NOT NULL, "name" varchar(50) NOT NULL, "password_hash" varchar(60) NOT NULL, "role" text NOT NULL DEFAULT ('reader'), "active" boolean NOT NULL DEFAULT (1), "label" text(100), "created_at" datetime NOT NULL DEFAULT (datetime('now')), "updated_at" datetime NOT NULL DEFAULT (datetime('now')), CONSTRAINT "UQ_51b8b26ac168fbe7d6f5653e6cf" UNIQUE ("name"))`,
		);
		await queryRunner.query(
			`INSERT INTO "users"("id", "name", "password_hash", "role", "active", "label", "created_at") SELECT "id", "name", "password_hash", "role", "active", "label", "created_at" FROM "temporary_users"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_users"`);
		await queryRunner.query(`CREATE INDEX "IDX_0890d8ebe90990c78fe4804231" ON "users" ("active") `);
		await queryRunner.query(`CREATE INDEX "IDX_b1096b9f73b49497a8c8d460ed" ON "invites" ("used", "expires_at") `);
	}
}
