import type {MigrationInterface, QueryRunner} from 'typeorm';

export class AddAnalyticsAndLnAnalyticsTables1771000429984 implements MigrationInterface {
	name = 'AddAnalyticsAndLnAnalyticsTables1771000429984';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "analytics_checkpoint" ("module" text NOT NULL, "scope" text NOT NULL, "data_type" text NOT NULL, "last_index" integer NOT NULL DEFAULT (0), "updated_at" integer NOT NULL, PRIMARY KEY ("module", "scope", "data_type"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "analytics_lightning" ("id" varchar PRIMARY KEY NOT NULL, "node_pubkey" text NOT NULL, "group_key" text NOT NULL DEFAULT (''), "unit" text NOT NULL DEFAULT ('msat'), "metric" text NOT NULL, "date" integer NOT NULL, "amount" bigint NOT NULL, "updated_at" integer NOT NULL)`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_e2cf698c195518128f385dd876" ON "analytics_lightning" ("node_pubkey", "group_key", "unit", "metric", "date") `,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "IDX_e2cf698c195518128f385dd876"`);
		await queryRunner.query(`DROP TABLE "analytics_lightning"`);
		await queryRunner.query(`DROP TABLE "analytics_checkpoint"`);
	}
}
