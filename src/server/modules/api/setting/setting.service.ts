/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {SettingService} from '@server/modules/setting/setting.service';
import {ErrorService} from '@server/modules/error/error.service';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
import {SettingKey} from '@server/modules/setting/setting.enums';
import {Setting} from '@server/modules/setting/setting.entity';
import {isSettingSensitive, maskSensitiveValue} from '@server/modules/setting/setting.helpers';
import {MessageService} from '@server/modules/message/message.service';
/* Local Dependencies */
import {OrchardSetting} from './setting.model.js';

/** Setting keys that require message service reinitialization when changed */
const MESSAGE_KEYS = new Set<SettingKey>([SettingKey.MESSAGES_ENABLED, SettingKey.MESSAGES_VENDOR, SettingKey.MESSAGES_TELEGRAM_BOT_TOKEN]);

@Injectable()
export class ApiSettingService {
	private readonly logger = new Logger(ApiSettingService.name);

	constructor(
		private settingService: SettingService,
		private errorService: ErrorService,
		private messageService: MessageService,
	) {}

	async getSettings(tag: string): Promise<OrchardSetting[]> {
		try {
			const settings = await this.settingService.getSettings();
			return settings.map((setting) => this.toMaskedOrchardSetting(setting));
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.SettingError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	async updateSettings(tag: string, keys: SettingKey[], values: string[]): Promise<OrchardSetting[]> {
		try {
			if (keys.length !== values.length) throw OrchardErrorCode.SettingError;
			const settings = await this.settingService.updateSettings(keys, values);
			if (keys.some((key) => MESSAGE_KEYS.has(key))) {
				await this.messageService.reinitialize();
			}
			return settings.map((setting) => this.toMaskedOrchardSetting(setting));
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.SettingError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	/**
	 * Convert a Setting entity to an OrchardSetting GraphQL model,
	 * masking the value if the setting is sensitive.
	 * @param {Setting} setting - The setting with real (decrypted) value
	 * @returns {OrchardSetting} The GraphQL model with masked value if sensitive
	 */
	private toMaskedOrchardSetting(setting: Setting): OrchardSetting {
		const is_sensitive = isSettingSensitive(setting.key, setting.value);
		const masked_value = is_sensitive ? maskSensitiveValue(setting.value) : undefined;
		return new OrchardSetting(setting, is_sensitive, masked_value);
	}
}
