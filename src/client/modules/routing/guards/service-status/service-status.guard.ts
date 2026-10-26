/* Core Dependencies */
import {inject} from '@angular/core';
import type {CanMatchFn} from '@angular/router';
/* Vendor Dependencies */
import {catchError, defer, map, of, retry, throwError, timer} from 'rxjs';
/* Application Dependencies */
import {AuthService} from '@client/modules/auth/services/auth/auth.service';
import {ConfigService} from '@client/modules/config/services/config.service';
import {isAuthRedirectError} from '@client/modules/error/helpers/error.helpers';

/** Load the server's service flags before interior routes are matched, so every canMatch guard reads them. */
export const serviceStatusGuard: CanMatchFn = () => {
	const authService = inject(AuthService);
	const configService = inject(ConfigService);
	// Without a session the activation guards redirect to login; querying first would only log a server error
	if (!authService.isAuthenticated() && !authService.getRefreshToken()) return true;
	return defer(() => configService.loadStatus()).pipe(
		// Ride out a restart or network blip before falling back to unknown flags
		retry({count: 2, delay: (error: unknown) => (isAuthRedirectError(error) ? throwError(() => error) : timer(1000))}),
		map(() => true),
		catchError(() => of(true)),
	);
};
