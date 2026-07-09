/* Core Dependencies */
import {NgModule} from '@angular/core';
import {CommonModule as CoreCommonModule} from '@angular/common';
import {ReactiveFormsModule as CoreReactiveFormsModule} from '@angular/forms';
import {RouterModule as CoreRouterModule} from '@angular/router';
/* Vendor Dependencies */
import {MatIconModule} from '@angular/material/icon';
import {MatCardModule} from '@angular/material/card';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatSelectModule} from '@angular/material/select';
import {MatMenuModule} from '@angular/material/menu';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {BaseChartDirective as ChartJsBaseChartDirective} from 'ng2-charts';
/* Application Dependencies */
import {OrcFormModule} from '@client/modules/form/form.module';
import {OrcChartModule} from '@client/modules/chart/chart.module';
/* Local Dependencies */
import {MintSubsectionSystemComponent} from './components/mint-subsection-system/mint-subsection-system.component';
import {MintSubsectionSystemControlComponent} from './components/mint-subsection-system-control/mint-subsection-system-control.component';
import {MintSubsectionSystemChartComponent} from './components/mint-subsection-system-chart/mint-subsection-system-chart.component';

@NgModule({
	declarations: [MintSubsectionSystemComponent, MintSubsectionSystemControlComponent, MintSubsectionSystemChartComponent],
	imports: [
		CoreRouterModule.forChild([
			{
				path: '',
				component: MintSubsectionSystemComponent,
			},
		]),
		CoreCommonModule,
		CoreReactiveFormsModule,
		MatIconModule,
		MatCardModule,
		MatButtonModule,
		MatFormFieldModule,
		MatSelectModule,
		MatMenuModule,
		MatDatepickerModule,
		MatProgressSpinnerModule,
		ChartJsBaseChartDirective,
		OrcFormModule,
		OrcChartModule,
	],
	exports: [],
})
export class OrcMintSubsectionSystemModule {}
