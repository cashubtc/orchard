/* Core Dependencies */
import {NgModule} from '@angular/core';
import {RouterModule as CoreRouterModule} from '@angular/router';
/* Vendor Dependencies */
import {MatIconModule} from '@angular/material/icon';

/* Application Dependencies */
import {OrcPublicModule} from '@client/modules/public/public.module';
/* Local Dependencies */
import {LightningSubsectionDisabledComponent} from './components/lightning-subsection-disabled/lightning-subsection-disabled.component';

@NgModule({
	declarations: [LightningSubsectionDisabledComponent],
	imports: [
		CoreRouterModule.forChild([
			{
				path: '',
				component: LightningSubsectionDisabledComponent,
			},
		]),
		MatIconModule,
		OrcPublicModule,
	],
	exports: [],
})
export class OrcLightningSubsectionDisabledModule {}
