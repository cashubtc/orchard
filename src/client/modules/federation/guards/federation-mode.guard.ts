/* Core Dependencies */
import {inject} from '@angular/core';
import {Router, type CanActivateChildFn} from '@angular/router';

/* Vendor Dependencies */
import {catchError, map, of} from 'rxjs';

/* Application Dependencies */
import {isAuthRedirectError} from '@client/modules/error/helpers/error.helpers';

/* Native Dependencies */
import {FederationService} from '@client/modules/federation/services/federation.service';

/** Gate every mint child before its HTTP/database/RPC resolvers run. */
export const federationModeGuard: CanActivateChildFn = () => {
	const federationService = inject(FederationService);
	const router = inject(Router);
	return federationService.loadMode().pipe(
		map(({mode}) => (mode === 'setup' || mode === 'unreachable' ? router.createUrlTree(['/mint/federation']) : true)),
		catchError((error: unknown) => of(isAuthRedirectError(error) ? false : router.createUrlTree(['/mint/federation']))),
	);
};
