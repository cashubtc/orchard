/* Core Dependencies */
import {Module, Logger} from '@nestjs/common';
import {ConfigModule, ConfigService} from '@nestjs/config';
import {GraphQLModule} from '@nestjs/graphql';
import {ApolloDriver, type ApolloDriverConfig} from '@nestjs/apollo';
/* Vendor Dependencies */
import {TypeOrmModule} from '@nestjs/typeorm';
import {DataSource, type DataSourceOptions} from 'typeorm';
import {ScheduleModule} from '@nestjs/schedule';
import {EventEmitterModule} from '@nestjs/event-emitter';
/* Application Modules */
import {SecurityModule} from './modules/security/security.module.js';
import {AuthModule} from './modules/auth/auth.module.js';
import {ApiModule} from './modules/api/api.module.js';
import {FetchModule} from './modules/fetch/fetch.module.js';
import {WebserverModule} from './modules/webserver/webserver.module.js';
import {TaskModule} from './modules/task/task.module.js';
/* Database Migrations */
import * as migrations from './database/migrations/index.js';
/* Custom Graphql Type Definitions */
import {UnixTimestamp} from './modules/graphql/scalars/unixtimestamp.scalar.js';
import {Timezone} from './modules/graphql/scalars/timezone.scalar.js';
import {Base64} from './modules/graphql/scalars/base64.scalar.js';
/* Application Configuration */
import {config} from './config/configuration.js';

function initializeGraphQL(configService: ConfigService): ApolloDriverConfig {
	const path = configService.get('server.path');
	const is_production = configService.get('mode.production');

	return {
		autoSchemaFile: is_production ? true : 'schema.gql',
		sortSchema: true,
		path: path,
		subscriptions: {
			'graphql-ws': true,
		},
		resolvers: {
			UnixTimestamp: UnixTimestamp,
			Timezone: Timezone,
			Base64: Base64,
		},
		formatError: (error) => {
			if (!configService.get('mode.production')) return error;
			return {
				message: error.message,
				extensions: {
					code: error.extensions?.code,
				},
			};
		},
	};
}

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
			load: [config],
			envFilePath: ['.env'],
		}),
		GraphQLModule.forRootAsync<ApolloDriverConfig>({
			driver: ApolloDriver,
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => initializeGraphQL(configService),
		}),
		TypeOrmModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => ({
				type: 'better-sqlite3',
				database: configService.get('mode.schema_only') ? ':memory:' : configService.get('database.path'),
				entities: [],
				synchronize: configService.get('mode.schema_only') ? true : configService.get('database.synchronize'),
				autoLoadEntities: true,
				migrations: configService.get('mode.schema_only') ? [] : Object.values(migrations),
				migrationsRun: configService.get('mode.schema_only') ? false : configService.get('mode.production'),
				retryAttempts: configService.get('mode.schema_only') ? 0 : 10,
			}),
			dataSourceFactory: async (options: DataSourceOptions) => {
				const data_source = new DataSource(options);
				await data_source.initialize();
				if (options.synchronize && !options.migrationsRun) {
					await data_source.runMigrations({fake: true});
				}
				return data_source;
			},
		}),
		ScheduleModule.forRoot(),
		EventEmitterModule.forRoot(),
		SecurityModule,
		AuthModule,
		ApiModule,
		FetchModule,
		WebserverModule,
		TaskModule,
	],
	providers: [Logger],
})
export class AppModule {}
