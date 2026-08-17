import type {MigrationInterface, QueryRunner} from 'typeorm';

export class AddMintAnalyticsTable1773321339762 implements MigrationInterface {
	name = 'AddMintAnalyticsTable1773321339762';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "analytics_mint" ("id" varchar PRIMARY KEY NOT NULL, "mint_pubkey" text NOT NULL, "keyset_id" text NOT NULL DEFAULT (''), "unit" text NOT NULL, "metric" text NOT NULL, "date" integer NOT NULL, "amount" bigint NOT NULL, "count" integer NOT NULL DEFAULT (0), "updated_at" integer NOT NULL)`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_308aeff112fa01f78494b194b5" ON "analytics_mint" ("mint_pubkey", "keyset_id", "unit", "metric", "date") `,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "IDX_308aeff112fa01f78494b194b5"`);
		await queryRunner.query(`DROP TABLE "analytics_mint"`);
	}
}
