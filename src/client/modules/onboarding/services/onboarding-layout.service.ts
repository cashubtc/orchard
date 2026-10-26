/* Core Dependencies */
import {inject, Injectable} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {BreakpointObserver, Breakpoints} from '@angular/cdk/layout';

/* Vendor Dependencies */
import {map} from 'rxjs';

@Injectable({providedIn: 'root'})
export class OnboardingLayoutService {
	private readonly breakpoints = inject(BreakpointObserver);
	public readonly mobile = toSignal(this.breakpoints.observe(Breakpoints.XSmall).pipe(map((result) => result.matches)), {
		initialValue: false,
	});
}
