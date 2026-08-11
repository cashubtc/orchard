import type {MigrationInterface, QueryRunner} from 'typeorm';

export class AddLnAnalyticsCountColumn1773321439513 implements MigrationInterface {
	name = 'AddLnAnalyticsCountColumn1773321439513';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "IDX_e2cf698c195518128f385dd876"`);
		await queryRunner.query(
			`CREATE TABLE "temporary_analytics_lightning" ("id" varchar PRIMARY KEY NOT NULL, "node_pubkey" text NOT NULL, "group_key" text NOT NULL DEFAULT (''), "unit" text NOT NULL DEFAULT ('msat'), "metric" text NOT NULL, "date" integer NOT NULL, "amount" bigint NOT NULL, "updated_at" integer NOT NULL, "count" integer NOT NULL DEFAULT (0))`,
		);
		await queryRunner.query(
			`INSERT INTO "temporary_analytics_lightning"("id", "node_pubkey", "group_key", "unit", "metric", "date", "amount", "updated_at") SELECT "id", "node_pubkey", "group_key", "unit", "metric", "date", "amount", "updated_at" FROM "analytics_lightning"`,
		);
		await queryRunner.query(`DROP TABLE "analytics_lightning"`);
		await queryRunner.query(`ALTER TABLE "temporary_analytics_lightning" RENAME TO "analytics_lightning"`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_e2cf698c195518128f385dd876" ON "analytics_lightning" ("node_pubkey", "group_key", "unit", "metric", "date") `,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "IDX_e2cf698c195518128f385dd876"`);
		await queryRunner.query(`ALTER TABLE "analytics_lightning" RENAME TO "temporary_analytics_lightning"`);
		await queryRunner.query(
			`CREATE TABLE "analytics_lightning" ("id" varchar PRIMARY KEY NOT NULL, "node_pubkey" text NOT NULL, "group_key" text NOT NULL DEFAULT (''), "unit" text NOT NULL DEFAULT ('msat'), "metric" text NOT NULL, "date" integer NOT NULL, "amount" bigint NOT NULL, "updated_at" integer NOT NULL)`,
		);
		await queryRunner.query(
			`INSERT INTO "analytics_lightning"("id", "node_pubkey", "group_key", "unit", "metric", "date", "amount", "updated_at") SELECT "id", "node_pubkey", "group_key", "unit", "metric", "date", "amount", "updated_at" FROM "temporary_analytics_lightning"`,
		);
		await queryRunner.query(`DROP TABLE "temporary_analytics_lightning"`);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_e2cf698c195518128f385dd876" ON "analytics_lightning" ("node_pubkey", "group_key", "unit", "metric", "date") `,
		);
	}
}
