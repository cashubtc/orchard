import type {MigrationInterface, QueryRunner} from 'typeorm';

export class AddCashuWalletTables1794348628826 implements MigrationInterface {
	name = 'AddCashuWalletTables1794348628826';

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
			`CREATE TABLE "cashu_wallet_operations" ("id" varchar PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "mint_id" text NOT NULL, "method" text, "type" text NOT NULL, "state" text NOT NULL, "revision" integer NOT NULL DEFAULT (0), "unit" text NOT NULL, "amount" integer NOT NULL, "quote_id" text, "quote_counter" integer, "memo" text, "request" text, "expiry" integer, "fee" integer, "fee_reserve" integer, "fee_index" integer, "preview" text, "counters" text, "inputs" text, "token" text, "payment_proof" text, "error" text, "created_at" integer NOT NULL, "updated_at" integer NOT NULL)`,
		);
		await queryRunner.query(`CREATE INDEX "IDX_c5fd76660207102232c2bf0a51" ON "cashu_wallet_operations" ("mint_id", "quote_id") `);
		await queryRunner.query(`CREATE INDEX "IDX_69ed44119dbc3ba953fa0c742e" ON "cashu_wallet_operations" ("user_id", "created_at") `);
		await queryRunner.query(`CREATE INDEX "IDX_e4f44e142d1ffd25d61b857637" ON "cashu_wallet_operations" ("state") `);
		await queryRunner.query(
			`CREATE TABLE "cashu_wallet_mints" ("id" varchar PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "pubkey" text, "urls" text NOT NULL, "created_at" integer NOT NULL)`,
		);
		await queryRunner.query(`CREATE INDEX "IDX_87ad8a4e79b760339c406cc310" ON "cashu_wallet_mints" ("user_id") `);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "IDX_45c61727a5e1f615ef22bd8ccc" ON "cashu_wallet_mints" ("user_id", "pubkey") WHERE pubkey IS NOT NULL`,
		);
		await queryRunner.query(
			`CREATE TABLE "cashu_wallet_mint_infos" ("mint_url" text PRIMARY KEY NOT NULL, "pubkey" text, "name" text, "info" text NOT NULL, "info_updated_at" integer NOT NULL, "keysets_updated_at" integer)`,
		);
		await queryRunner.query(
			`CREATE TABLE "cashu_wallet_mint_keysets" ("mint_url" text NOT NULL, "id" text NOT NULL, "unit" text NOT NULL, "active" boolean NOT NULL, "input_fee_ppk" integer NOT NULL DEFAULT (0), "final_expiry" integer, "keys" text, "updated_at" integer NOT NULL, PRIMARY KEY ("mint_url", "id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "cashu_wallet_quotes" ("id" varchar PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "mint_id" text NOT NULL, "method" text NOT NULL, "unit" text NOT NULL, "quote_id" text NOT NULL, "quote_counter" integer NOT NULL, "request" text NOT NULL, "amount" integer, "description" text, "expiry" integer, "amount_paid" integer NOT NULL DEFAULT (0), "amount_issued" integer NOT NULL DEFAULT (0), "last_paid_at" integer, "latest" boolean NOT NULL DEFAULT (1), "chain_height" integer, "deposits" text, "created_at" integer NOT NULL, "updated_at" integer NOT NULL)`,
		);
		await queryRunner.query(`CREATE UNIQUE INDEX "IDX_2abdc10500931bf495ba15547d" ON "cashu_wallet_quotes" ("mint_id", "quote_id") `);
		await queryRunner.query(`CREATE INDEX "IDX_06d55a0f98c1168265b9adc2ef" ON "cashu_wallet_quotes" ("user_id", "mint_id", "method") `);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`DROP INDEX "IDX_06d55a0f98c1168265b9adc2ef"`);
		await queryRunner.query(`DROP INDEX "IDX_2abdc10500931bf495ba15547d"`);
		await queryRunner.query(`DROP TABLE "cashu_wallet_quotes"`);
		await queryRunner.query(`DROP TABLE "cashu_wallet_mint_keysets"`);
		await queryRunner.query(`DROP TABLE "cashu_wallet_mint_infos"`);
		await queryRunner.query(`DROP INDEX "IDX_45c61727a5e1f615ef22bd8ccc"`);
		await queryRunner.query(`DROP INDEX "IDX_87ad8a4e79b760339c406cc310"`);
		await queryRunner.query(`DROP TABLE "cashu_wallet_mints"`);
		await queryRunner.query(`DROP INDEX "IDX_e4f44e142d1ffd25d61b857637"`);
		await queryRunner.query(`DROP INDEX "IDX_69ed44119dbc3ba953fa0c742e"`);
		await queryRunner.query(`DROP INDEX "IDX_c5fd76660207102232c2bf0a51"`);
		await queryRunner.query(`DROP TABLE "cashu_wallet_operations"`);
		await queryRunner.query(`DROP INDEX "IDX_0317ba18fd31878dd48da168da"`);
		await queryRunner.query(`DROP INDEX "IDX_2483ff4a215b2b42f606ee48dd"`);
		await queryRunner.query(`DROP TABLE "cashu_wallet_proofs"`);
		await queryRunner.query(`DROP TABLE "cashu_wallet_counters"`);
		await queryRunner.query(`DROP TABLE "cashu_wallet_seed"`);
	}
}
