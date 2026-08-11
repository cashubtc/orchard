import type {MigrationInterface, QueryRunner} from 'typeorm';

export class AddSystemMetricsTable1773321408860 implements MigrationInterface {
	name = 'AddSystemMetricsTable1773321408860';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "metrics_system" ("id" varchar PRIMARY KEY NOT NULL, "metric" text NOT NULL, "date" integer NOT NULL, "value" real NOT NULL, "updated_at" integer NOT NULL)`,
		);
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_822b5339f18f10390be3f2f9a5" ON "metrics_system" ("metric", "date") `);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "IDX_822b5339f18f10390be3f2f9a5"`);
		await queryRunner.query(`DROP TABLE "metrics_system"`);
	}
}
