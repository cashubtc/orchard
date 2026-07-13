/* Core Dependencies */
import {NgModule} from '@angular/core';
import {RouterModule as CoreRouterModule} from '@angular/router';
/* Vendor Dependencies */
import {MatIconModule} from '@angular/material/icon';
import {MatCardModule} from '@angular/material/card';
import {MatButtonModule} from '@angular/material/button';
/* Application Dependencies */
import {OrcChartModule} from '@client/modules/chart/chart.module';
import {OrcSystemModule} from '@client/modules/system/system.module';
/* Local Dependencies */
import {MintSubsectionSystemComponent} from './components/mint-subsection-system/mint-subsection-system.component';

@NgModule({
	declarations: [MintSubsectionSystemComponent],
	imports: [
		CoreRouterModule.forChild([
			{
				path: '',
				component: MintSubsectionSystemComponent,
			},
		]),
		MatIconModule,
		MatCardModule,
		MatButtonModule,
		OrcChartModule,
		OrcSystemModule,
	],
	exports: [],
})
export class OrcMintSubsectionSystemModule {}
