import type {MigrationInterface, QueryRunner} from 'typeorm';

export class AddTokenBlacklistTable1762206212857 implements MigrationInterface {
	name = 'AddTokenBlacklistTable1762206212857';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "token_blacklist" ("id" varchar PRIMARY KEY NOT NULL, "token_hash" varchar(64) NOT NULL, "user_id" varchar NOT NULL, "expires_at" integer NOT NULL, "revoked_at" integer NOT NULL, CONSTRAINT "UQ_fc93690d4ba3c359bfaaa99a7a3" UNIQUE ("token_hash"))`,
		);
		await queryRunner.query(`CREATE INDEX "IDX_fc93690d4ba3c359bfaaa99a7a" ON "token_blacklist" ("token_hash") `);
		await queryRunner.query(`CREATE INDEX "IDX_f843323a807f2db43c4d8ba888" ON "token_blacklist" ("expires_at") `);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "IDX_f843323a807f2db43c4d8ba888"`);
		await queryRunner.query(`DROP INDEX "IDX_fc93690d4ba3c359bfaaa99a7a"`);
		await queryRunner.query(`DROP TABLE "token_blacklist"`);
	}
}
