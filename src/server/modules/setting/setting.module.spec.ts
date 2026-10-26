import {Test} from '@nestjs/testing';
import {ConfigModule, ConfigService} from '@nestjs/config';
import {getRepositoryToken} from '@nestjs/typeorm';
import {SettingModule} from './setting.module.js';
import {Setting} from './setting.entity.js';
import {SettingKey, SettingValue} from './setting.enums.js';
import {SettingService} from './setting.service.js';

describe('SettingModule', () => {
	it('initializes settings without replacing integration configuration', async () => {
		const repository = {
			find: async () => [],
			findOne: async () => ({key: SettingKey.BITCOIN_ORACLE, value: 'true', value_type: SettingValue.BOOLEAN}),
		};
		const module = await Test.createTestingModule({
			imports: [
				ConfigModule.forRoot({isGlobal: true, ignoreEnvFile: true, load: [() => ({bitcoin: {host: 'environment'}})]}),
				SettingModule,
			],
		})
			.overrideProvider(getRepositoryToken(Setting))
			.useValue(repository)
			.compile();
		await module.init();
		const config = module.get(ConfigService);
		expect(config.get('service_environment')).toBeUndefined();
		expect(config.get('bitcoin.host')).toBe('environment');
		expect(await module.get(SettingService).getBooleanSetting(SettingKey.BITCOIN_ORACLE)).toBe(true);
		await module.close();
	});
});
