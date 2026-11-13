/* Core Dependencies */
import fs from 'node:fs/promises';
try {
	process.loadEnvFile('.env');
} catch (error) {
	if (error.code !== 'ENOENT') throw error;
}

const mode = {
	production: process.env['NODE_ENV'] === 'production',
	dev_auth_bypass: process.env['DEV_AUTH_BYPASS'] === 'true',
	version: `orchard/${process.env['npm_package_version'] || '1.0.0'}`,
};

const api = {
	proxy: mode.production ? '' : '/proxy',
	path: process.env['BASE_PATH'] || 'api',
};

const bitcoin = {
	enabled: process.env['BITCOIN_TYPE'] ? true : false,
};

const lightning = {
	enabled: process.env['LIGHTNING_TYPE'] ? true : false,
};

const taproot_assets = {
	enabled: process.env['TAPROOT_ASSETS_TYPE'] ? true : false,
};

const mint = {
	enabled: process.env['MINT_TYPE'] ? true : false,
	type: process.env['MINT_TYPE'] || 'cdk',
	critical_path: '/v1/info',
	database_type: process.env['MINT_DATABASE']?.match(/postgres(ql)?:\/\//) ? 'postgres' : 'sqlite',
	metrics: process.env['MINT_TYPE'] === 'cdk' && !!process.env['MINT_METRICS_API'],
};

const constants = {
	epoch_start: 1521072000,
	taproot_group_keys: {
		usdt: '02e7548544171496a6f2307326ea55fc98a1764f469ad8760b07ee7201c7206ff5',
	},
};

const runtime_config = {
	mode,
	api,
	bitcoin,
	lightning,
	taproot_assets,
	mint,
	constants,
};

if (process.env.NODE_ENV === 'production') {
	const data_dir = process.env.DATABASE_DIR || 'data';
	await fs.mkdir(`${data_dir}/tmp`, {recursive: true});
	const output_path = `${data_dir}/config.json`;
	await fs.writeFile(output_path, JSON.stringify(runtime_config, null, 2));
} else {
	const output_path = `${process.cwd()}/public/config.json`;
	await fs.writeFile(output_path, JSON.stringify(runtime_config, null, 2));
}