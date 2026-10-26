import {Test} from '@nestjs/testing';
import {ConfigService} from '@nestjs/config';
import {MintMetricsService} from '#server/modules/cashu/mintmetrics/mintmetrics.service';
import {SettingService} from '#server/modules/setting/setting.service';
import {ServiceSettingKey} from '#server/modules/service-config/enums/service-config.enums';
import {BitcoinRpcService} from '#server/modules/bitcoin/rpc/btcrpc.service';
import {ClnService} from '#server/modules/lightning/cln/cln.service';
import {LightningService} from '#server/modules/lightning/lightning/lightning.service';
import {LightningWalletKitService} from '#server/modules/lightning/walletkit/lnwalletkit.service';
import {CashuMintRpcService} from '#server/modules/cashu/mintrpc/cashumintrpc.service';
import {CashuMintDatabaseService} from '#server/modules/cashu/mintdb/cashumintdb.service';
import {CdkRpcService} from '#server/modules/cashu/cdk/cdkrpc.service';
import {BitcoinAnalyticsService} from '#server/modules/bitcoin/analytics/btcanalytics.service';
import {LightningAnalyticsService} from '#server/modules/lightning/analytics/lnanalytics.service';
import {CashuMintAnalyticsService} from '#server/modules/cashu/mintanalytics/mintanalytics.service';
import {ServiceConfigService} from './service-config.service.js';
import {ServiceTestService} from './service-test.service.js';
import type {ConnectionCheck, ConnectionInput} from './types/service-config.types.js';

const success: ConnectionCheck = {
	ok: true,
	warning: false,
	saved: false,
	title: 'Connected',
	context: '',
	diagnostic: null,
	fields: [],
	chain: 'regtest',
	chain_match: null,
	mode: null,
	bitcoin_version: null,
	bitcoin_blocks: null,
	mint_member_id: null,
	mint_member_count: null,
};

describe('ServiceConfigService', () => {
	let service: ServiceConfigService;
	let config: ConfigService;
	const rows = new Map<ServiceSettingKey, string>();
	const test = jest.fn();
	const update = jest.fn(async (keys: ServiceSettingKey[], values: string[]) => {
		keys.forEach((key, index) => rows.set(key, values[index]));
		return keys.map((key, index) => ({key, value: values[index]}));
	});
	const reconnect = jest.fn();
	const pause = jest.fn(async () => undefined);
	const testDatabase = jest.fn();
	const isValid = jest.fn();
	const input: ConnectionInput = {
		service: 'bitcoin',
		values: [
			{key: 'type', value: 'core'},
			{key: 'host', value: 'new-node'},
			{key: 'port', value: '18443'},
			{key: 'user', value: 'operator'},
		],
	};

	beforeEach(async () => {
		jest.clearAllMocks();
		rows.clear();
		test.mockResolvedValue(success);
		isValid.mockReturnValue(true);
		const environment = {
			bitcoin: {type: 'core', host: 'env-node', port: '8332', user: 'env-user', pass: 'env-secret'},
			lightning: {},
			mint: {},
		};
		config = new ConfigService({bitcoin: {...environment.bitcoin}, lightning: {}, cashu: {}, service_environment: environment});
		const module = await Test.createTestingModule({
			providers: [
				ServiceConfigService,
				{provide: ConfigService, useValue: config},
				{
					provide: SettingService,
					useValue: {getSettings: async () => Array.from(rows, ([key, value]) => ({key, value})), updateSettings: update},
				},
				{provide: ServiceTestService, useValue: {test, testDatabase, isValid}},
				...[
					BitcoinRpcService,
					LightningService,
					ClnService,
					LightningWalletKitService,
					CashuMintRpcService,
					CashuMintDatabaseService,
					CdkRpcService,
				].map((provide) => ({provide, useValue: {reinitialize: reconnect}})),
				{provide: MintMetricsService, useValue: {reinitialize: reconnect, isEnabled: () => false}},
				...[BitcoinAnalyticsService, LightningAnalyticsService, CashuMintAnalyticsService].map((provide) => ({
					provide,
					useValue: {pause, reinitialize: jest.fn()},
				})),
			],
		}).compile();
		service = module.get(ServiceConfigService);
	});

	it('reports env source but returns only secret presence', async () => {
		const result = (await service.getConfigurations())[0];
		expect(result.source).toBe('environment');
		expect(result.fields.find((field) => field.key === 'password')).toEqual({key: 'password', value: null, secret: true, set: true});
		expect(JSON.stringify(result)).not.toContain('env-secret');
	});

	it('copies unchanged env credentials to Orchard and applies the new connection', async () => {
		await service.save(input, false);
		expect(test.mock.calls[0][1].password).toBe('env-secret');
		expect(rows.get(ServiceSettingKey.SERVICE_BITCOIN_PASSWORD)).toBe('env-secret');
		expect(config.get('bitcoin.host')).toBe('new-node');
		expect((await service.getStatus())[0].source).toBe('orchard');
		expect(pause).not.toHaveBeenCalled();
		expect(reconnect).toHaveBeenCalled();
	});

	it('probes an unavailable mint database again after the recheck window', async () => {
		config.set('cashu.database', '/mint/cdk-mintd.sqlite');
		const now = jest.spyOn(Date, 'now').mockReturnValue(1_000_000);
		testDatabase.mockRejectedValueOnce(new Error('unable to open database file')).mockResolvedValue(undefined);
		service.onApplicationBootstrap();
		expect((await service.getStatus()).find((state) => state.service === 'mint')?.database).toBe(false);
		expect(testDatabase).toHaveBeenCalledTimes(1);
		now.mockReturnValue(1_000_000 + 30_000);
		expect((await service.getStatus()).find((state) => state.service === 'mint')?.database).toBe(true);
		expect(testDatabase).toHaveBeenCalledTimes(2);
		now.mockRestore();
	});

	it('drains the analytics that read the Lightning identity before switching nodes', async () => {
		await service.remove('lightning');
		expect(pause).toHaveBeenCalledTimes(2);
	});

	it('tests without saving and blocks a failed save unless explicitly bypassed', async () => {
		test.mockResolvedValue({...success, ok: false});
		await service.test(input);
		expect((await service.save(input, false)).saved).toBe(false);
		expect(update).not.toHaveBeenCalled();
		expect((await service.save(input, true)).saved).toBe(true);
		expect(update).toHaveBeenCalledTimes(1);
		expect((await service.getStatus())[0].status).toBe('unreachable');
	});

	it('never saves malformed credentials, even when the connection failure is accepted', async () => {
		test.mockResolvedValue({...success, ok: false, fields: ['cert']});
		isValid.mockReturnValue(false);
		expect((await service.save(input, true)).saved).toBe(false);
		expect(update).not.toHaveBeenCalled();
	});

	it('distinguishes an omitted credential from an explicitly cleared one', async () => {
		await service.test({...input, values: [...input.values, {key: 'password', value: ''}]});
		expect(test.mock.calls[0][1].password).toBe('');
	});

	it('removes without reactivating environment settings and clears retained credentials', async () => {
		await service.remove('bitcoin');
		expect(rows.get(ServiceSettingKey.SERVICE_BITCOIN_ENABLED)).toBe('false');
		expect(config.get('bitcoin.type')).toBe('');
		expect(config.get('bitcoin.pass')).toBe('');
		expect((await service.getStatus())[0]).toMatchObject({enabled: false, source: 'none', status: 'not_configured'});
	});

	it('normalizes submitted and persisted connection values before testing', async () => {
		const normalized_input: ConnectionInput = {
			service: 'bitcoin',
			values: [
				{key: 'type', value: ' core '},
				{key: 'host', value: ' new-node '},
				{key: 'port', value: ' 18443 '},
				{key: 'user', value: ' operator '},
				{key: 'password', value: ' keep spaces '},
			],
		};
		await service.save(normalized_input, false);
		expect(test).toHaveBeenCalledWith('bitcoin', {
			type: 'core',
			host: 'new-node',
			port: '18443',
			user: 'operator',
			password: ' keep spaces ',
		});
		expect(rows.get(ServiceSettingKey.SERVICE_BITCOIN_HOST)).toBe('new-node');
	});

	it('saves the metrics URL from the form and keeps database TLS for the same database', async () => {
		config.set('service_environment.mint', {
			type: 'cdk',
			metrics_api: 'http://old/metrics',
			database_ca: 'old-ca',
			database_cert: 'old-cert',
			database_key: 'old-key',
		});
		await service.save(
			{
				service: 'mint',
				values: [
					{key: 'type', value: 'cdk'},
					{key: 'host', value: 'new-mint'},
					{key: 'metrics', value: 'http://new-mint:9090'},
				],
			},
			false,
		);
		expect(config.get('cashu')).toMatchObject({
			metrics_api: 'http://new-mint:9090',
			database_ca: 'old-ca',
			database_cert: 'old-cert',
			database_key: 'old-key',
		});
		await service.remove('mint');
		expect(config.get('cashu')).toMatchObject({type: ''});
	});

	it('rejects unknown fields before touching settings', async () => {
		expect(() => service.test({...input, values: [{key: 'unexpected', value: 'x'}]})).toThrow('Unknown service field');
		expect(update).not.toHaveBeenCalled();
	});
});
