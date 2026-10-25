import {SettingKey} from '#server/modules/setting/setting.enums';
import {isSettingSensitive} from '#server/modules/setting/setting.helpers';
import {connectionConfig, mergeServiceConfig} from './service-config.helpers.js';

describe('service configuration precedence', () => {
	const env = {type: 'core', host: 'environment', pass: 'env-password'};
	it('uses environment until an override exists', () => expect(mergeServiceConfig('bitcoin', env, new Map())).toEqual(env));
	it('retains removal across a fresh merge', () => {
		expect(mergeServiceConfig('bitcoin', env, new Map([[SettingKey.SERVICE_BITCOIN_ENABLED, 'false']])).type).toBe('');
	});
	it('uses saved blanks as deliberate overrides', () => {
		expect(
			mergeServiceConfig(
				'bitcoin',
				env,
				new Map([
					[SettingKey.SERVICE_BITCOIN_ENABLED, 'true'],
					[SettingKey.SERVICE_BITCOIN_TYPE, 'core'],
				]),
			).pass,
		).toBe('');
	});
	it('rewrites local addresses for Docker like env values', () => {
		const docker_env = process.env.DOCKER_ENV;
		process.env.DOCKER_ENV = 'true';
		try {
			const config = connectionConfig('mint', {
				host: '127.0.0.1',
				api: 'http://localhost:3338',
				database: 'postgres://u:p@localhost/mint',
			});
			expect(config.rpc_host).toBe('host.docker.internal');
			expect(config.api).toBe('http://host.docker.internal:3338');
			expect(config.database_type).toBe('postgres');
		} finally {
			if (docker_env === undefined) delete process.env.DOCKER_ENV;
			else process.env.DOCKER_ENV = docker_env;
		}
	});
	it('encrypts passwords and pasted credentials, but permits credential paths', () => {
		expect(isSettingSensitive(SettingKey.SERVICE_BITCOIN_PASSWORD, '/still-a-password')).toBe(true);
		expect(isSettingSensitive(SettingKey.SERVICE_LIGHTNING_CERT, '-----BEGIN CERTIFICATE-----')).toBe(true);
		expect(isSettingSensitive(SettingKey.SERVICE_LIGHTNING_CERT, '/cert.pem')).toBe(false);
		expect(isSettingSensitive(SettingKey.SERVICE_MINT_DATABASE, 'postgres://user:password@db/mint')).toBe(true);
	});
});
