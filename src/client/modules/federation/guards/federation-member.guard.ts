/* Core Dependencies */
import {inject} from '@angular/core';
import type {CanMatchFn} from '@angular/router';

/* Vendor Dependencies */
import {catchError, map, of} from 'rxjs';

/* Native Dependencies */
import {FederationService} from '@client/modules/federation/services/federation.service';

/** Match the member dashboard only for a federation member; anything else falls through to the setup page. */
export const federationMemberGuard: CanMatchFn = () =>
	inject(FederationService)
		.loadMode()
		.pipe(
			map(({mode}) => mode === 'member'),
			catchError(() => of(false)),
		);
