/* Core Dependencies */
import {NestFactory} from '@nestjs/core';
import {ConfigService} from '@nestjs/config';
import {Logger, ConsoleLogger, type LogLevel, type INestApplication} from '@nestjs/common';
import {existsSync} from 'node:fs';
import compression from 'compression';
/* Vendor Dependencies */
import * as express from 'express';
/* Application */
import {AppModule} from './app.module.js';
import {securityHeaders, indexHtml} from './modules/middleware/index.js';
import {BitcoinType} from './modules/bitcoin/bitcoin.enums.js';
import {LightningType} from './modules/lightning/lightning.enums.js';
import {TaprootAssetType} from './modules/tapass/tapass.enums.js';
import {MintType} from './modules/cashu/cashu.enums.js';

const log_levels: Record<string, LogLevel[]> = {
	verbose: ['log', 'fatal', 'error', 'warn', 'debug', 'verbose'],
	debug: ['log', 'fatal', 'error', 'warn', 'debug'],
	info: ['log', 'fatal', 'error', 'warn'],
	warn: ['fatal', 'error', 'warn'],
	error: ['fatal', 'error'],
	fatal: ['fatal'],
};

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	const configService = app.get(ConfigService);
	const loglevel = configService.get<string>('server.log') || 'info';
	app.useLogger(
		new ConsoleLogger('OrchardApplication', {
			logLevels: log_levels[loglevel],
			timestamp: loglevel === 'verbose' || loglevel === 'debug' ? true : false,
		}),
	);
	const logger = new Logger('OrchardApplication');
	validation(app, configService, logger);
	const is_production = configService.get<boolean>('mode.production') ?? false;
	app.use(securityHeaders(is_production));
	if (is_production) app.use(indexHtml());
	app.getHttpAdapter().getInstance().disable('x-powered-by');
	const compression_enabled = configService.get<boolean>('server.compression');
	if (compression_enabled) app.use(compression());
	app.use(express.json({limit: '10mb'}));
	app.use(express.urlencoded({limit: '10mb', extended: true}));
	const port = configService.get<number>('server.port');
	const path = configService.get<string>('server.path');
	const host = configService.get<string>('server.host');
	const version = configService.get<string>('mode.version');
	app.setGlobalPrefix(path);
	await app.listen(port, host);
	const dev_auth_bypass = configService.get<boolean>('mode.dev_auth_bypass');
	if (dev_auth_bypass) logger.warn('DEV_AUTH_BYPASS is enabled — all unauthenticated requests get admin access');
	logger.log(`Application version ${version}`);
	logger.log(`Application is running on: ${host}:${port}`);
}

function validation(app: INestApplication, configService: ConfigService, logger: Logger): void {
	// validate BITCOIN_TYPE
	const bitcoin_type = configService.get<BitcoinType>('bitcoin.type');
	if (bitcoin_type && !Object.values(BitcoinType).includes(bitcoin_type)) shutdown(app, logger, `Invalid BITCOIN_TYPE: ${bitcoin_type}`);
	// validate LIGHTNING_TYPE
	const lightning_type = configService.get<LightningType>('lightning.type');
	if (lightning_type && !Object.values(LightningType).includes(lightning_type))
		shutdown(app, logger, `Invalid LIGHTNING_TYPE: ${lightning_type}`);
	// validate TAPROOT_ASSET_TYPE
	const taproot_asset_type = configService.get<TaprootAssetType>('taproot_assets.type');
	if (taproot_asset_type && !Object.values(TaprootAssetType).includes(taproot_asset_type))
		shutdown(app, logger, `Invalid TAPROOT_ASSET_TYPE: ${taproot_asset_type}`);
	// validate MINT_TYPE
	const mint_type = configService.get<MintType>('cashu.type');
	if (mint_type && !Object.values(MintType).includes(mint_type)) shutdown(app, logger, `Invalid MINT_TYPE: ${mint_type}`);
	// validate MINT_DATABASE
	const mint_database = configService.get<string>('cashu.database');
	if (mint_type && !mint_database) shutdown(app, logger, 'MINT_DATABASE not configured');
	const mint_database_type = configService.get<string>('cashu.database_type');
	if (mint_type && mint_database && mint_database_type === 'sqlite' && !existsSync(mint_database)) {
		const is_docker = configService.get<boolean>('mode.docker') ?? false;
		const hint = is_docker
			? ' Host paths are not visible inside the container — set MINT_DATANAME (filename) and MINT_DATADIR (host directory) so the sqlite file is mounted automatically.'
			: '';
		shutdown(app, logger, `MINT_DATABASE file not found at "${mint_database}".${hint}`);
	}
}

function shutdown(app: INestApplication, logger: Logger, error: string): never {
	logger.error(error);
	void app.close();
	process.exit(1);
}

bootstrap();
