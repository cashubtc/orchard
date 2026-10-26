/* Core Dependencies */
import {ChangeDetectionStrategy, Component, inject} from '@angular/core';
import {toSignal} from '@angular/core/rxjs-interop';
import {RouterLink} from '@angular/router';

/* Vendor Dependencies */
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {catchError, map, of} from 'rxjs';

/* Application Dependencies */
import {CrewService} from '@client/modules/crew/services/crew/crew.service';
import {SERVICE_DESCRIPTORS} from '@client/modules/service-config/constants/service-config.constants';

/* Native Dependencies */
import {ONBOARDING_COPY, ONBOARDING_SERVICES} from '@client/modules/onboarding/constants/onboarding.constants';

/* Shared Dependencies */
import {UserRole} from '@shared/generated.types';

@Component({
	selector: 'orc-first-run-empty',
	imports: [RouterLink, MatButtonModule, MatIconModule],
	templateUrl: './first-run-empty.component.html',
	styleUrl: './first-run-empty.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FirstRunEmptyComponent {
	private readonly crewService = inject(CrewService);

	public readonly services = ONBOARDING_SERVICES;
	public readonly descriptors = SERVICE_DESCRIPTORS;
	public readonly copy = ONBOARDING_COPY;
	// Setup actions stay hidden until administrator access has been confirmed
	public readonly is_admin = toSignal(
		this.crewService.loadUser().pipe(
			map((user) => user.role === UserRole.Admin),
			catchError(() => of(false)),
		),
		{initialValue: false},
	);
}
