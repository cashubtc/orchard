/* Core Dependencies */
import {inject} from '@angular/core';
import {Router, type CanActivateFn} from '@angular/router';
/* Application Dependencies */
import {ConfigService} from '@client/modules/config/services/config.service';

/** Keep management available when optional data connections have not been configured. */
export const mintDataGuard: CanActivateFn = (route) => {
	const config = inject(ConfigService).config.mint;
	const missing_api = route.data['requires_public_api'] && !config.public_api;
	const missing_database = route.data['requires_database'] && !config.database;
	const connection = missing_api && missing_database ? 'both' : missing_api ? 'public_api' : missing_database ? 'database' : null;
	return connection ? inject(Router).createUrlTree(['/mint/data-unavailable'], {queryParams: {connection}}) : true;
};
