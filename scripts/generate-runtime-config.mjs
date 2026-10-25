/* Core Dependencies */
import fs from 'node:fs/promises';
import {config} from 'dotenv';
config({path: '.env', override: false, quiet: true});

const mode = {
	production: process.env['NODE_ENV'] === 'production',
	dev_auth_bypass: process.env['DEV_AUTH_BYPASS'] === 'true',
	version: `orchard/${process.env['npm_package_version'] || '1.0.0'}`,
};

const api = {
	proxy: mode.production ? '' : '/proxy',
	path: process.env['BASE_PATH'] || 'api',
};

// Editable service flags are loaded from the authenticated server before section navigation.
const bitcoin = {
	enabled: false,
};

const lightning = {
	enabled: false,
};

const taproot_assets = {
	enabled: process.env['TAPROOT_ASSETS_TYPE'] ? true : false,
};

const mint = {
	enabled: false,
	type: 'cdk',
	critical_path: '/v1/info',
	database_type: 'sqlite',
	database: false,
	public_api: false,
	metrics: false,
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
	const output_path = `${process.cwd()}/dist/client/browser/config.json`;
	await fs.writeFile(output_path, JSON.stringify(runtime_config, null, 2));
} else {
	const output_path = `${process.cwd()}/public/config.json`;
	await fs.writeFile(output_path, JSON.stringify(runtime_config, null, 2));
}
