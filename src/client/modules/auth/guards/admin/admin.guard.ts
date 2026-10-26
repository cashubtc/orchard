/* Core Dependencies */
import {inject} from '@angular/core';
import {Router, type CanActivateFn} from '@angular/router';

/* Vendor Dependencies */
import {catchError, map, of} from 'rxjs';

/* Application Dependencies */
import {CrewService} from '@client/modules/crew/services/crew/crew.service';
import {isAuthRedirectError} from '@client/modules/error/helpers/error.helpers';

/** Allow administrators to configure services; other users return to the home page. */
export const adminGuard: CanActivateFn = () => {
	const router = inject(Router);
	return inject(CrewService)
		.isAdmin()
		.pipe(
			map((is_admin) => (is_admin ? true : router.createUrlTree(['/']))),
			catchError((error: unknown) => of(isAuthRedirectError(error) ? false : router.createUrlTree(['/']))),
		);
};
