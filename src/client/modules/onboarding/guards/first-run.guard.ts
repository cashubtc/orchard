/* Core Dependencies */
import {inject} from '@angular/core';
import type {CanMatchFn} from '@angular/router';
/* Application Dependencies */
import {ConfigService} from '@client/modules/config/services/config.service';

/** Match the first-run home only while no service is connected. */
export const firstRunGuard: CanMatchFn = () => {
	const config = inject(ConfigService).config;
	return !config.bitcoin.enabled && !config.lightning.enabled && !config.mint.enabled && !config.taproot_assets.enabled;
};
