/* Local Dependencies */
import {Config} from './configuration.type';
import {loadOrCreateCryptoKey, generateEphemeralJwtSecret} from './crypto-key';

const replaceLocalhostInDocker = (host: string | undefined): string | undefined => {
	if (!host) return host;
	if (!process.env.DOCKER_ENV) return host;
	return host
		.replace(/\/\/localhost(?=[:/]|$)/gi, '//host.docker.internal')
		.replace(/\/\/127\.0\.0\.1(?=[:/]|$)/g, '//host.docker.internal')
		.replace(/\blocalhost\b/gi, 'host.docker.internal')
		.replace(/\b127\.0\.0\.1\b/g, 'host.docker.internal')
		.replace(/\[::1\]/g, 'host.docker.internal')
		.replace(/::1(?=[:/]|$)/g, 'host.docker.internal');
};

const getMintRpcMtls = (): boolean => {
	if (process.env.MINT_RPC_MTLS === 'true') return true;
	if (process.env.MINT_RPC_MTLS === 'false') return false;
	return !!(process.env.MINT_RPC_KEY && process.env.MINT_RPC_CERT && process.env.MINT_RPC_CA);
};

export const config = (): Config => {
	const setup_key = process.env.SETUP_KEY || process.env.ADMIN_PASSWORD;
	const crypto_key = process.env.SCHEMA_ONLY === 'true' ? '' : loadOrCreateCryptoKey();
	const jwt_mode = process.env.DEV_AUTH_BYPASS === 'true' && process.env.SCHEMA_ONLY !== 'true' ? 'persistent' : 'ephemeral';
	const jwt_secret = jwt_mode === 'persistent' ? crypto_key : generateEphemeralJwtSecret();

	const mode = {
		production: process.env.NODE_ENV === 'production',
		dev_auth_bypass: process.env.DEV_AUTH_BYPASS === 'true',
		schema_only: process.env.SCHEMA_ONLY === 'true',
		docker: process.env.DOCKER_ENV === 'true',
		version: `orchard/${process.env['npm_package_version'] || '1.0.0'}`,
	};

	const server = {
		host: process.env.SERVER_HOST || 'localhost',
		port: process.env.SERVER_PORT || '3321',
		path: process.env.BASE_PATH || 'api',
		proxy: process.env.TOR_PROXY_SERVER || undefined,
		log: process.env.LOG_LEVEL || 'warn',
		setup_key,
		crypto_key,
		jwt_secret,
		ttl: process.env.THROTTLE_TTL || '60000',
		limit: process.env.THROTTLE_LIMIT || '20',
		compression: process.env.SERVER_COMPRESSION === 'true',
	};

	const database = {
		path: `${process.env.DATABASE_DIR || 'data'}/orchard.db`,
		synchronize: process.env.NODE_ENV !== 'production',
	};

	const bitcoin = {
		type: process.env.BITCOIN_TYPE,
		host: replaceLocalhostInDocker(process.env.BITCOIN_RPC_HOST),
		port: process.env.BITCOIN_RPC_PORT,
		user: process.env.BITCOIN_RPC_USER,
		pass: process.env.BITCOIN_RPC_PASSWORD,
	};

	const lightning = {
		type: process.env.LIGHTNING_TYPE,
		host: replaceLocalhostInDocker(process.env.LIGHTNING_RPC_HOST),
		port: process.env.LIGHTNING_RPC_PORT,
		macaroon: process.env.LIGHTNING_MACAROON,
		cert: process.env.LIGHTNING_CERT,
		key: process.env.LIGHTNING_KEY,
		ca: process.env.LIGHTNING_CA,
	};

	const taproot_assets = {
		type: process.env.TAPROOT_ASSETS_TYPE,
		host: replaceLocalhostInDocker(process.env.TAPROOT_ASSETS_RPC_HOST),
		port: process.env.TAPROOT_ASSETS_RPC_PORT,
		macaroon: process.env.TAPROOT_ASSETS_MACAROON,
		cert: process.env.TAPROOT_ASSETS_CERT,
	};

	const cashu = {
		type: process.env.MINT_TYPE,
		api: replaceLocalhostInDocker(process.env.MINT_API),
		database_type: process.env.MINT_DATABASE?.match(/postgres(ql)?:\/\//) ? 'postgres' : 'sqlite',
		database: replaceLocalhostInDocker(process.env.MINT_DATABASE),
		database_ca: process.env.MINT_DATABASE_CA,
		database_cert: process.env.MINT_DATABASE_CERT,
		database_key: process.env.MINT_DATABASE_KEY,
		rpc_host: replaceLocalhostInDocker(process.env.MINT_RPC_HOST),
		rpc_port: process.env.MINT_RPC_PORT,
		rpc_mtls: getMintRpcMtls(),
		rpc_key: process.env.MINT_RPC_KEY,
		rpc_cert: process.env.MINT_RPC_CERT,
		rpc_ca: process.env.MINT_RPC_CA,
	};

	const config = {
		mode,
		server,
		database,
		bitcoin,
		lightning,
		taproot_assets,
		cashu,
	};

	return config;
};
