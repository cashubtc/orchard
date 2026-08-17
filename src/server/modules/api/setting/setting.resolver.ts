/* Core Dependencies */
import {Logger, UseInterceptors} from '@nestjs/common';
import {Resolver, Query, Mutation, Args} from '@nestjs/graphql';
/* Application Dependencies */
import {Roles} from '#server/modules/auth/decorators/auth.decorator';
import {UserRole} from '#server/modules/user/user.enums';
import {SettingKey} from '#server/modules/setting/setting.enums';
import {LogEvent} from '#server/modules/event/event.decorator';
import {EventLogType} from '#server/modules/event/event.enums';
/* Local Dependencies */
import {ApiSettingService} from './setting.service.js';
import {OrchardSetting} from './setting.model.js';
import {SettingInterceptor} from './setting.interceptor.js';

@Resolver()
export class SettingResolver {
	private readonly logger = new Logger(SettingResolver.name);

	constructor(private settingService: ApiSettingService) {}

	@Query(() => [OrchardSetting], {description: 'Get all application settings'})
	async settings(): Promise<OrchardSetting[]> {
		const tag = 'GET { settings }';
		this.logger.debug(tag);
		return await this.settingService.getSettings(tag);
	}

	@Roles(UserRole.ADMIN)
	@UseInterceptors(SettingInterceptor)
	@LogEvent({
		type: EventLogType.UPDATE,
		field: 'setting',
		arg_keys: ['values'],
		old_value_key: 'value',
	})
	@Mutation(() => [OrchardSetting], {description: 'Update application settings'})
	async settings_update(
		@Args('keys', {type: () => [SettingKey], description: 'Setting keys to update'}) keys: SettingKey[],
		@Args('values', {type: () => [String], description: 'New values for the settings'}) values: string[],
	): Promise<OrchardSetting[]> {
		const tag = 'UPDATE { settings }';
		this.logger.debug(tag);
		return await this.settingService.updateSettings(tag, keys, values);
	}
}
