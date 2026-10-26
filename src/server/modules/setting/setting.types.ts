/* Application Dependencies */
import type {ServiceSettingKey} from '#server/modules/service-config/enums/service-config.enums';

/* Local Dependencies */
import type {SettingKey} from './setting.enums.js';

export type StoredSettingKey = SettingKey | ServiceSettingKey;
