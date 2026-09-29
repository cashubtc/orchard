import type {MigrationInterface, QueryRunner} from 'typeorm';

export class AddCashuWalletTables1790715355313 implements MigrationInterface {
	name = 'AddCashuWalletTables1790715355313';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "cashu_wallet_seed" ("user_id" text PRIMARY KEY NOT NULL, "mnemonic" text NOT NULL, "created_at" integer NOT NULL, "backed_up_at" integer)`,
		);
		await queryRunner.query(
			`CREATE TABLE "cashu_wallet_counters" ("user_id" text NOT NULL, "counter_key" text NOT NULL, "next" integer NOT NULL DEFAULT (0), "updated_at" integer NOT NULL, PRIMARY KEY ("user_id", "counter_key"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "cashu_wallet_proofs" ("secret" text PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "mint_id" text NOT NULL, "keyset_id" text NOT NULL, "unit" text NOT NULL, "amount" integer NOT NULL, "c" text NOT NULL, "dleq" text, "state" text NOT NULL DEFAULT ('READY'), "created_by_op_id" text, "used_by_op_id" text, "created_at" integer NOT NULL, "updated_at" integer NOT NULL)`,
		);
		await queryRunner.query(`CREATE INDEX "IDX_2483ff4a215b2b42f606ee48dd" ON "cashu_wallet_proofs" ("used_by_op_id") `);
		await queryRunner.query(
			`CREATE INDEX "IDX_0317ba18fd31878dd48da168da" ON "cashu_wallet_proofs" ("user_id", "mint_id", "unit", "state") `,
		);
		await queryRunner.query(
			`CREATE TABLE "cashu_wallet_operations" ("id" varchar PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "mint_id" text NOT NULL, "method" text, "type" text NOT NULL, "state" text NOT NULL, "revision" integer NOT NULL DEFAULT (0), "unit" text NOT NULL, "amount" integer NOT NULL, "quote_id" text, "quote_counter" integer, "memo" text, "outputs" text, "inputs" text, "error" text, "created_at" integer NOT NULL, "updated_at" integer NOT NULL)`,
		);
		await queryRunner.query(`CREATE INDEX "IDX_27c9f0a5c7d87acd8d74b85c84" ON "cashu_wallet_operations" ("user_id") `);
		await queryRunner.query(`CREATE INDEX "IDX_e4f44e142d1ffd25d61b857637" ON "cashu_wallet_operations" ("state") `);
		await queryRunner.query(
			`CREATE TABLE "cashu_wallet_mints" ("id" varchar PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "pubkey" text, "urls" text NOT NULL, "name" text, "info" text, "info_updated_at" integer, "created_at" integer NOT NULL)`,
		);
		await queryRunner.query(`CREATE INDEX "IDX_87ad8a4e79b760339c406cc310" ON "cashu_wallet_mints" ("user_id") `);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_45c61727a5e1f615ef22bd8ccc" ON "cashu_wallet_mints" ("user_id", "pubkey") WHERE pubkey IS NOT NULL`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "IDX_45c61727a5e1f615ef22bd8ccc"`);
		await queryRunner.query(`DROP INDEX "IDX_87ad8a4e79b760339c406cc310"`);
		await queryRunner.query(`DROP TABLE "cashu_wallet_mints"`);
		await queryRunner.query(`DROP INDEX "IDX_e4f44e142d1ffd25d61b857637"`);
		await queryRunner.query(`DROP INDEX "IDX_27c9f0a5c7d87acd8d74b85c84"`);
		await queryRunner.query(`DROP TABLE "cashu_wallet_operations"`);
		await queryRunner.query(`DROP INDEX "IDX_0317ba18fd31878dd48da168da"`);
		await queryRunner.query(`DROP INDEX "IDX_2483ff4a215b2b42f606ee48dd"`);
		await queryRunner.query(`DROP TABLE "cashu_wallet_proofs"`);
		await queryRunner.query(`DROP TABLE "cashu_wallet_counters"`);
		await queryRunner.query(`DROP TABLE "cashu_wallet_seed"`);
	}
}
