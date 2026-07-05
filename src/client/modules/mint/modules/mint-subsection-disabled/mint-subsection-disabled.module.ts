/* Core Dependencies */
import {NgModule} from '@angular/core';
import {CommonModule as CoreCommonModule} from '@angular/common';
import {RouterModule as CoreRouterModule} from '@angular/router';
/* Vendor Dependencies */
import {MatIconModule} from '@angular/material/icon';
/* Application Dependencies */
import {OrcPublicModule} from '@client/modules/public/public.module';
/* Local Dependencies */
import {MintSubsectionDisabledComponent} from './components/mint-subsection-disabled/mint-subsection-disabled.component';

@NgModule({
	declarations: [MintSubsectionDisabledComponent],
	imports: [
		CoreRouterModule.forChild([
			{
				path: '',
				component: MintSubsectionDisabledComponent,
			},
		]),
		CoreCommonModule,
		MatIconModule,
		OrcPublicModule,
	],
	exports: [],
})
export class OrcMintSubsectionDisabledModule {}
