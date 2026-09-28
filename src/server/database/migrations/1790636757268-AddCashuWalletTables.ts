import type {MigrationInterface, QueryRunner} from 'typeorm';

export class AddCashuWalletTables1790636757268 implements MigrationInterface {
	name = 'AddCashuWalletTables1790636757268';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "cashu_wallet_seed" ("user_id" text PRIMARY KEY NOT NULL, "mnemonic" text NOT NULL, "created_at" integer NOT NULL)`,
		);
		await queryRunner.query(
			`CREATE TABLE "cashu_wallet_counters" ("user_id" text NOT NULL, "keyset_id" text NOT NULL, "next" integer NOT NULL DEFAULT (0), "updated_at" integer NOT NULL, PRIMARY KEY ("user_id", "keyset_id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "cashu_wallet_proofs" ("secret" text PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "keyset_id" text NOT NULL, "unit" text NOT NULL, "amount" integer NOT NULL, "c" text NOT NULL, "dleq" text, "state" text NOT NULL DEFAULT ('READY'), "created_by_op_id" text, "used_by_op_id" text, "created_at" integer NOT NULL, "updated_at" integer NOT NULL)`,
		);
		await queryRunner.query(`CREATE INDEX "IDX_2483ff4a215b2b42f606ee48dd" ON "cashu_wallet_proofs" ("used_by_op_id") `);
		await queryRunner.query(`CREATE INDEX "IDX_47f4565e318c2550d981e5dbbf" ON "cashu_wallet_proofs" ("user_id", "unit", "state") `);
		await queryRunner.query(
			`CREATE TABLE "cashu_wallet_operations" ("id" varchar PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "type" text NOT NULL, "state" text NOT NULL, "revision" integer NOT NULL DEFAULT (0), "unit" text NOT NULL, "amount" integer NOT NULL, "quote_id" text, "outputs" text, "inputs" text, "error" text, "created_at" integer NOT NULL, "updated_at" integer NOT NULL)`,
		);
		await queryRunner.query(`CREATE INDEX "IDX_27c9f0a5c7d87acd8d74b85c84" ON "cashu_wallet_operations" ("user_id") `);
		await queryRunner.query(`CREATE INDEX "IDX_e4f44e142d1ffd25d61b857637" ON "cashu_wallet_operations" ("state") `);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "IDX_e4f44e142d1ffd25d61b857637"`);
		await queryRunner.query(`DROP INDEX "IDX_27c9f0a5c7d87acd8d74b85c84"`);
		await queryRunner.query(`DROP TABLE "cashu_wallet_operations"`);
		await queryRunner.query(`DROP INDEX "IDX_47f4565e318c2550d981e5dbbf"`);
		await queryRunner.query(`DROP INDEX "IDX_2483ff4a215b2b42f606ee48dd"`);
		await queryRunner.query(`DROP TABLE "cashu_wallet_proofs"`);
		await queryRunner.query(`DROP TABLE "cashu_wallet_counters"`);
		await queryRunner.query(`DROP TABLE "cashu_wallet_seed"`);
	}
}
