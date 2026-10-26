import {ServiceSettingKey} from '#server/modules/service-config/enums/service-config.enums';
import {isSettingSensitive} from '#server/modules/setting/setting.helpers';
import {
	connectionConfig,
	diagnosticFields,
	mergeServiceConfig,
	normalizeConnectionValue,
	redactDiagnostic,
} from './service-config.helpers.js';

describe('diagnosticFields', () => {
	it('does not mistake a port containing 401 for an authentication failure', () => {
		expect(diagnosticFields('connect ECONNREFUSED 10.0.0.2:14013', 'bitcoin')).toEqual(['host', 'port']);
		expect(diagnosticFields('401 Unauthorized', 'bitcoin')).toEqual(['user', 'password']);
	});
	it("flags LND's macaroon rejection and keeps Bitcoin TLS failures on the host", () => {
		expect(diagnosticFields('2 UNKNOWN: verification failed: signature mismatch after caveat verification', 'lightning')).toEqual([
			'macaroon',
		]);
		expect(diagnosticFields('self-signed certificate in certificate chain', 'bitcoin')).toEqual(['host']);
	});
});

describe('service configuration precedence', () => {
	const env = {type: 'core', host: 'environment', pass: 'env-password'};
	it('uses environment until an override exists', () => expect(mergeServiceConfig('bitcoin', env, new Map())).toEqual(env));
	it('retains removal across a fresh merge', () => {
		expect(mergeServiceConfig('bitcoin', env, new Map([[ServiceSettingKey.SERVICE_BITCOIN_ENABLED, 'false']])).type).toBe('');
	});
	it('uses saved blanks as deliberate overrides', () => {
		expect(
			mergeServiceConfig(
				'bitcoin',
				env,
				new Map([
					[ServiceSettingKey.SERVICE_BITCOIN_ENABLED, 'true'],
					[ServiceSettingKey.SERVICE_BITCOIN_TYPE, 'core'],
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
		expect(isSettingSensitive(ServiceSettingKey.SERVICE_BITCOIN_PASSWORD, '/still-a-password')).toBe(true);
		expect(isSettingSensitive(ServiceSettingKey.SERVICE_LIGHTNING_CERT, '-----BEGIN CERTIFICATE-----')).toBe(true);
		expect(isSettingSensitive(ServiceSettingKey.SERVICE_LIGHTNING_CERT, '/cert.pem')).toBe(false);
		expect(isSettingSensitive(ServiceSettingKey.SERVICE_MINT_DATABASE, 'postgres://user:password@db/mint')).toBe(true);
	});
});

describe('connection normalization', () => {
	it('trims addresses, usernames, URLs and paths without changing PEM content or passwords', () => {
		const pem = '  -----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----\n';
		expect(normalizeConnectionValue('cert', pem)).toBe(pem);
		expect(normalizeConnectionValue('cert', '  /tmp/cert.pem  ')).toBe('/tmp/cert.pem');
		expect(normalizeConnectionValue('password', ' pass ')).toBe(' pass ');
		expect(connectionConfig('bitcoin', {host: ' node ', user: ' user ', port: ' 8332 '})).toMatchObject({
			host: 'node',
			user: 'user',
			port: '8332',
		});
		expect(connectionConfig('mint', {api: ' https://mint.test ', database: ' /data/mint.db '})).toMatchObject({
			api: 'https://mint.test',
			database: '/data/mint.db',
		});
	});
	describe('environment-only mint metrics and database TLS', () => {
		const environment = {
			type: 'cdk',
			rpc_host: 'mint',
			rpc_port: '8086',
			database: 'postgres://mint-db/mint',
			metrics_api: 'http://mint/metrics',
			database_ca: 'ca',
			database_cert: 'cert',
			database_key: 'key',
		};
		const stored = (values: Record<string, string>): Map<ServiceSettingKey, string> =>
			new Map([
				[ServiceSettingKey.SERVICE_MINT_ENABLED, 'true'],
				[ServiceSettingKey.SERVICE_MINT_TYPE, 'cdk'],
				[ServiceSettingKey.SERVICE_MINT_HOST, values.host ?? 'mint'],
				[ServiceSettingKey.SERVICE_MINT_PORT, values.port ?? '8086'],
				[ServiceSettingKey.SERVICE_MINT_DATABASE, values.database ?? 'postgres://mint-db/mint'],
			]);
		it('keeps them when the override points at the same mint and database', () => {
			expect(mergeServiceConfig('mint', environment, stored({}))).toMatchObject({
				metrics_api: 'http://mint/metrics',
				database_ca: 'ca',
				database_cert: 'cert',
				database_key: 'key',
			});
		});
		it('drops metrics for another mint and database TLS for another database', () => {
			expect(mergeServiceConfig('mint', environment, stored({host: 'other-mint'}))).toMatchObject({
				metrics_api: '',
				database_ca: 'ca',
			});
			expect(mergeServiceConfig('mint', environment, stored({database: '/data/other.sqlite'}))).toMatchObject({
				metrics_api: 'http://mint/metrics',
				database_ca: '',
				database_cert: '',
				database_key: '',
			});
		});
	});
});

describe('redactDiagnostic', () => {
	it('keeps short-secret substrings readable while removing longer secrets and database credentials', () => {
		const error = new Error('password bypass failed; pass; very-private; postgres://u:p@db/mint');
		expect(redactDiagnostic(error, ['pass', 'very-private', ''])).toBe(
			'password bypass failed; pass; [redacted]; postgres://[redacted]@db/mint',
		);
	});
});
