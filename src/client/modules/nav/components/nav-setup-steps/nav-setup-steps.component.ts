/* Core Dependencies */
import {ChangeDetectionStrategy, Component, inject, input} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {BreakpointObserver, Breakpoints} from '@angular/cdk/layout';

/* Vendor Dependencies */
import {map} from 'rxjs';
import {MatIconModule} from '@angular/material/icon';

@Component({
	selector: 'orc-nav-setup-steps',
	host: {'[class.mobile]': 'mobile()'},
	imports: [MatIconModule],
	templateUrl: './nav-setup-steps.component.html',
	styleUrl: './nav-setup-steps.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavSetupStepsComponent {
	private readonly breakpoints = inject(BreakpointObserver);

	public readonly mobile = toSignal(this.breakpoints.observe(Breakpoints.XSmall).pipe(map((state) => state.matches)), {
		initialValue: false,
	});
	/** Plain labels or step records with a title. */
	public readonly steps = input.required<string[], readonly (string | {title: string})[]>({
		transform: (steps) => steps.map((step) => (typeof step === 'string' ? step : step.title)),
	});
	public readonly current = input.required<number>();
}
