/* Core Dependencies */
import {NgModule} from '@angular/core';
import {RouterModule} from '@angular/router';

/* Application Dependencies */
import {adminGuard} from '@client/modules/auth/guards/admin/admin.guard';

/* Native Dependencies */
import {OnboardingComponent} from '@client/modules/onboarding/components/onboarding/onboarding.component';

@NgModule({
	imports: [
		RouterModule.forChild([{path: '', component: OnboardingComponent, canActivate: [adminGuard], title: 'Orchard | Set up services'}]),
	],
})
export class OrcOnboardingModule {}
