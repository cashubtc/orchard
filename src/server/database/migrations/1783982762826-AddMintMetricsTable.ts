import { MigrationInterface, QueryRunner } from "typeorm";

export class AddMintMetricsTable1783982762826 implements MigrationInterface {
    name = 'AddMintMetricsTable1783982762826'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "metrics_mint" ("id" varchar PRIMARY KEY NOT NULL, "metric" text NOT NULL, "labels" text NOT NULL, "type" text NOT NULL, "date" integer NOT NULL, "value" real, "sum" real, "count" integer, "buckets" text, "updated_at" integer NOT NULL)`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_789da0b78f49e6e28d4a2d2994" ON "metrics_mint" ("metric", "labels", "date") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "IDX_789da0b78f49e6e28d4a2d2994"`);
        await queryRunner.query(`DROP TABLE "metrics_mint"`);
    }

}
