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
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {BaseChartDirective as ChartJsBaseChartDirective} from 'ng2-charts';
/* Application Dependencies */
import {OrcFormModule} from '@client/modules/form/form.module';
/* Local Dependencies */
import {MintSubsectionServerComponent} from './components/mint-subsection-server/mint-subsection-server.component';
import {MintSubsectionServerControlComponent} from './components/mint-subsection-server-control/mint-subsection-server-control.component';
import {MintSubsectionServerSummaryComponent} from './components/mint-subsection-server-summary/mint-subsection-server-summary.component';
import {MintSubsectionServerChartComponent} from './components/mint-subsection-server-chart/mint-subsection-server-chart.component';

@NgModule({
	declarations: [
		MintSubsectionServerComponent,
		MintSubsectionServerControlComponent,
		MintSubsectionServerSummaryComponent,
		MintSubsectionServerChartComponent,
	],
	imports: [
		CoreRouterModule.forChild([
			{
				path: '',
				component: MintSubsectionServerComponent,
			},
		]),
		CoreCommonModule,
		CoreReactiveFormsModule,
		MatIconModule,
		MatCardModule,
		MatButtonModule,
		MatFormFieldModule,
		MatSelectModule,
		MatDatepickerModule,
		MatProgressSpinnerModule,
		ChartJsBaseChartDirective,
		OrcFormModule,
	],
	exports: [],
})
export class OrcMintSubsectionServerModule {}
