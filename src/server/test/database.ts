/* Vendor Dependencies */
import {TypeOrmModule} from '@nestjs/typeorm';
import type {DynamicModule} from '@nestjs/common';
/* Application Dependencies */
import * as migrations from '#server/database/migrations/index';

/**
 * An in-memory SQLite database built by running every migration, so a spec
 * exercises the schema, constraints and indexes that operators get
 * @param {Function[]} entities - The entities the spec reads and writes
 * @returns {DynamicModule} The TypeORM root module to import into a testing module
 */
export function migratedDatabase(entities: Function[]): DynamicModule {
	return TypeOrmModule.forRoot({
		type: 'better-sqlite3',
		database: ':memory:',
		entities,
		migrations: Object.values(migrations),
		migrationsRun: true,
		synchronize: false,
	});
}
