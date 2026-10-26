import {Test} from '@nestjs/testing';
import {ConfigModule, ConfigService} from '@nestjs/config';
import {getRepositoryToken} from '@nestjs/typeorm';
import {SettingModule} from '#server/modules/setting/setting.module';
import {SERVICE_CONFIG_BOOTSTRAP} from './service-config.module.js';
import {Setting} from '#server/modules/setting/setting.entity';
import {SettingValue} from '#server/modules/setting/setting.enums';
import type {StoredSettingKey} from '#server/modules/setting/setting.types';
import {ServiceSettingKey} from '#server/modules/service-config/enums/service-config.enums';
import {encryptValue, deriveEncryptionKeyFromHex} from '#server/modules/setting/setting.helpers';

describe('ServiceConfigModule early configuration', () => {
	it('decrypts and merges saved service settings before lifecycle initialization', async () => {
		const crypto_key = '12'.repeat(32);
		const rows = new Map<StoredSettingKey, Setting>();
		for (const [key, value] of [
			[ServiceSettingKey.SERVICE_BITCOIN_ENABLED, 'true'],
			[ServiceSettingKey.SERVICE_BITCOIN_TYPE, 'core'],
			[ServiceSettingKey.SERVICE_BITCOIN_HOST, 'saved-node'],
			[ServiceSettingKey.SERVICE_BITCOIN_PASSWORD, encryptValue('saved-password', deriveEncryptionKeyFromHex(crypto_key))],
		] as [ServiceSettingKey, string][])
			rows.set(key, {key, value, description: null, value_type: SettingValue.STRING});
		const repository = {
			find: async () => [...rows.values()],
			findOne: async ({where}: {where: {key: StoredSettingKey}}) => rows.get(where.key),
			create: (setting: Setting) => setting,
			save: async (setting: Setting) => {
				rows.set(setting.key, setting);
				return setting;
			},
		};
		const module = await Test.createTestingModule({
			providers: [SERVICE_CONFIG_BOOTSTRAP],
			imports: [
				ConfigModule.forRoot({
					isGlobal: true,
					ignoreEnvFile: true,
					load: [
						() => ({
							server: {crypto_key},
							bitcoin: {type: 'core', host: 'env-node', pass: 'env-password'},
							lightning: {},
							cashu: {},
						}),
					],
				}),
				SettingModule,
			],
		})
			.overrideProvider(getRepositoryToken(Setting))
			.useValue(repository)
			.compile();
		const config = module.get(ConfigService);
		expect(config.get('bitcoin.host')).toBe('saved-node');
		expect(config.get('bitcoin.pass')).toBe('saved-password');
		expect(config.get('service_environment.bitcoin.host')).toBe('env-node');
		await module.init();
		expect(config.get('bitcoin.host')).toBe('saved-node');
		await module.close();
	});
});
