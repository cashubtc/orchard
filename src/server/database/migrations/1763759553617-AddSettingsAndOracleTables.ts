import type {MigrationInterface, QueryRunner} from 'typeorm';

export class AddSettingsAndOracleTables1763759553617 implements MigrationInterface {
	name = 'AddSettingsAndOracleTables1763759553617';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "settings" ("key" varchar(100) PRIMARY KEY NOT NULL, "value" text NOT NULL, "description" text(255), "value_type" text(50) NOT NULL DEFAULT ('string'))`,
		);
		await queryRunner.query(
			`CREATE TABLE "utxoracle" ("id" varchar PRIMARY KEY NOT NULL, "date" integer NOT NULL, "price" integer NOT NULL, CONSTRAINT "UQ_879efb0342abd3ddea871bf12e8" UNIQUE ("date"))`,
		);
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_879efb0342abd3ddea871bf12e" ON "utxoracle" ("date") `);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "IDX_879efb0342abd3ddea871bf12e"`);
		await queryRunner.query(`DROP TABLE "utxoracle"`);
		await queryRunner.query(`DROP TABLE "settings"`);
	}
}
