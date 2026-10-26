/* Core Dependencies */
import {NgModule} from '@angular/core';
import {RouterModule} from '@angular/router';

/* Application Dependencies */
import {adminGuard} from '@client/modules/auth/guards/admin/admin.guard';

/* Native Dependencies */
import {onboardingService} from '@client/modules/onboarding/helpers/onboarding.helpers';
import {OnboardingComponent} from '@client/modules/onboarding/components/onboarding/onboarding.component';

@NgModule({
	imports: [
		RouterModule.forChild([
			{
				path: '',
				component: OnboardingComponent,
				canActivate: [adminGuard],
				title: 'Orchard | Set up services',
				children: [
					{path: 'services', data: {stage: 'services'}, children: []},
					{path: 'configure/:service', data: {stage: 'configure'}, children: []},
					{path: 'review', data: {stage: 'review'}, children: []},
					{
						path: '',
						pathMatch: 'full',
						redirectTo: ({queryParams}) => {
							const service = onboardingService(queryParams['service'] ?? null);
							return service ? `configure/${service}` : 'services';
						},
					},
				],
			},
		]),
	],
})
export class OrcOnboardingModule {}
