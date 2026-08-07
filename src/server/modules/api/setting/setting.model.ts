/* Core Dependencies */
import {Field, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {Setting} from '@server/modules/setting/setting.entity';
import {SettingValue, SettingKey} from '@server/modules/setting/setting.enums';

@ObjectType({description: 'Application configuration setting'})
export class OrchardSetting {
	@Field(() => SettingKey, {description: 'Unique key identifying the setting'})
	key: SettingKey;

	@Field({description: 'Current value of the setting'})
	value: string;

	@Field(() => String, {nullable: true, description: 'Human-readable description of the setting'})
	description: string | null;

	@Field(() => SettingValue, {description: 'Data type of the setting value'})
	value_type: SettingValue;

	@Field({description: 'Whether the setting contains sensitive data'})
	is_sensitive: boolean;

	constructor(setting: Setting, is_sensitive: boolean, masked_value?: string) {
		this.key = setting.key;
		this.value = masked_value ?? setting.value;
		this.description = setting.description;
		this.value_type = setting.value_type;
		this.is_sensitive = is_sensitive;
	}
}
