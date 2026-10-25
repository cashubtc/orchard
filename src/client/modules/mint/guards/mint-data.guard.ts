/* Core Dependencies */
import {inject} from '@angular/core';
import {Router, type CanActivateFn} from '@angular/router';
/* Application Dependencies */
import {ConfigService} from '@client/modules/config/services/config.service';

/** Keep management available when optional data connections have not been configured. */
export const mintDataGuard: CanActivateFn = (route) => {
	const config = inject(ConfigService).config.mint;
	const missing = (route.data['requires_public_api'] && !config.public_api) || (route.data['requires_database'] && !config.database);
	return missing ? inject(Router).createUrlTree(['/mint/data-unavailable']) : true;
};
