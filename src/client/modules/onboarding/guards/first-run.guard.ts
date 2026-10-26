/* Core Dependencies */
import {inject} from '@angular/core';
import type {CanMatchFn} from '@angular/router';
/* Application Dependencies */
import {ConfigService} from '@client/modules/config/services/config.service';

/** Match the first-run home only while no service is connected; unknown flags after a failed status load don't count. */
export const onboardingFirstRunGuard: CanMatchFn = () => {
	const configService = inject(ConfigService);
	const config = configService.config;
	if (!configService.status_loaded) return false;
	return !config.bitcoin.enabled && !config.lightning.enabled && !config.mint.enabled && !config.taproot_assets.enabled;
};
