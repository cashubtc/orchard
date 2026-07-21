/* Core Dependencies */
import {NgModule} from '@angular/core';
import {CommonModule as CoreCommonModule} from '@angular/common';
import {RouterModule as CoreRouterModule} from '@angular/router';
/* Vendor Dependencies */
import {MatIconModule} from '@angular/material/icon';
/* Application Dependencies */
import {OrcPublicModule} from '@client/modules/public/public.module';
/* Local Dependencies */
import {MintSubsectionSystemDisabledComponent} from './components/mint-subsection-system-disabled/mint-subsection-system-disabled.component';

@NgModule({
	declarations: [MintSubsectionSystemDisabledComponent],
	imports: [
		CoreRouterModule.forChild([
			{
				path: '',
				component: MintSubsectionSystemDisabledComponent,
			},
		]),
		CoreCommonModule,
		MatIconModule,
		OrcPublicModule,
	],
	exports: [],
})
export class OrcMintSubsectionSystemDisabledModule {}
