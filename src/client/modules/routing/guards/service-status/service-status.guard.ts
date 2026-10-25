/* Core Dependencies */
import {inject} from '@angular/core';
import type {CanMatchFn} from '@angular/router';
/* Vendor Dependencies */
import {catchError, map, of} from 'rxjs';
/* Application Dependencies */
import {ConfigService} from '@client/modules/config/services/config.service';

/** Load the server's service flags before interior routes are matched, so every canMatch guard reads them. */
export const serviceStatusGuard: CanMatchFn = () =>
	inject(ConfigService)
		.loadStatus()
		.pipe(
			map(() => true),
			catchError(() => of(true)),
		);
