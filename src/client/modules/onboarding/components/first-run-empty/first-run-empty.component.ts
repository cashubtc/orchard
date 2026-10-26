/* Core Dependencies */
import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {RouterLink} from '@angular/router';

/* Vendor Dependencies */
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {catchError, of} from 'rxjs';

/* Application Dependencies */
import {CrewService} from '@client/modules/crew/services/crew/crew.service';

/* Native Dependencies */
import {OnboardingLayoutService} from '@client/modules/onboarding/services/onboarding-layout.service';
import {ONBOARDING_COPY, ONBOARDING_DESCRIPTORS, ONBOARDING_SERVICES} from '@client/modules/onboarding/constants/onboarding.constants';

@Component({
	host: {'[class.mobile]': 'mobile()'},
	selector: 'orc-onboarding-first-run-empty',
	imports: [RouterLink, MatButtonModule, MatIconModule],
	templateUrl: './first-run-empty.component.html',
	styleUrl: './first-run-empty.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingFirstRunEmptyComponent {
	private readonly layout = inject(OnboardingLayoutService);
	private readonly crewService = inject(CrewService);

	public readonly mobile = this.layout.mobile;
	public readonly services = ONBOARDING_SERVICES;
	public readonly descriptors = ONBOARDING_DESCRIPTORS;
	public readonly copy = ONBOARDING_COPY;
	// Setup actions stay hidden until administrator access has been confirmed
	public readonly is_admin = toSignal(this.crewService.isAdmin().pipe(catchError(() => of(false))), {initialValue: false});
}
