import type {MigrationInterface, QueryRunner} from 'typeorm';

export class AddBitcoinAnalyticsTable1773321368684 implements MigrationInterface {
	name = 'AddBitcoinAnalyticsTable1773321368684';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "analytics_bitcoin" ("id" varchar PRIMARY KEY NOT NULL, "node_pubkey" text NOT NULL DEFAULT (''), "group_key" text NOT NULL DEFAULT (''), "unit" text NOT NULL DEFAULT ('sat'), "metric" text NOT NULL, "date" integer NOT NULL, "amount" bigint NOT NULL, "count" integer NOT NULL DEFAULT (0), "updated_at" integer NOT NULL)`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_b0557ad7224aed02e516ce26d0" ON "analytics_bitcoin" ("node_pubkey", "group_key", "unit", "metric", "date") `,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "IDX_b0557ad7224aed02e516ce26d0"`);
		await queryRunner.query(`DROP TABLE "analytics_bitcoin"`);
	}
}
