/* Core Dependencies */
import {inject} from '@angular/core';
import {Router, type CanActivateChildFn} from '@angular/router';

/* Vendor Dependencies */
import {catchError, map, of} from 'rxjs';

/* Application Dependencies */
import {isAuthRedirectError} from '@client/modules/error/helpers/error.helpers';

/* Native Dependencies */
import {FederationService} from '@client/modules/federation/services/federation.service';
import {isMintAvailable} from '@client/modules/federation/helpers/federation-setup.helpers';

/** Send a daemon in setup mode to setup before mint resolvers run; any other state keeps the mint pages and their own errors. */
export const federationModeGuard: CanActivateChildFn = () => {
	const federationService = inject(FederationService);
	const router = inject(Router);
	return federationService.loadMode().pipe(
		map(({mode}) => (isMintAvailable(mode) ? true : router.createUrlTree(['/mint/federation']))),
		catchError((error: unknown) => of(!isAuthRedirectError(error))),
	);
};
