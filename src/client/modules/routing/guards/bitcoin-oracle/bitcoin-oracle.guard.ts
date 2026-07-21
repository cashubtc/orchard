/* Core Dependencies */
import {inject} from '@angular/core';
import {CanMatchFn} from '@angular/router';
/* Application Dependencies */
import {SettingAppService} from '@client/modules/settings/services/setting-app/setting-app.service';

/** Matches the bitcoin oracle route only when the bitcoin_oracle app setting is enabled */
export const bitcoinOracleGuard: CanMatchFn = () => inject(SettingAppService).getSetting('bitcoin_oracle').value;
