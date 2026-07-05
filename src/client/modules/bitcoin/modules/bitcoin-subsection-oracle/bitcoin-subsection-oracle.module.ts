/* Core Dependencies */
import {NgModule} from '@angular/core';
import {CommonModule as CoreCommonModule} from '@angular/common';
import {RouterModule as CoreRouterModule} from '@angular/router';
import {ReactiveFormsModule as CoreReactiveFormsModule} from '@angular/forms';
/* Vendor Dependencies */
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatInputModule} from '@angular/material/input';
import {MatCardModule} from '@angular/material/card';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MAT_LUXON_DATE_ADAPTER_OPTIONS, provideLuxonDateAdapter} from '@angular/material-luxon-adapter';
import {BaseChartDirective as ChartJsBaseChartDirective} from 'ng2-charts';
/* Application Dependencies */
import {OrcTimeModule} from '@client/modules/time/time.module';
import {OrcFormModule} from '@client/modules/form/form.module';
import {OrcGraphicModule} from '@client/modules/graphic/graphic.module';
import {OrcProgressModule} from '@client/modules/progress/progress.module';
/* Local Dependencies */
import {BitcoinSubsectionOracleComponent} from './components/bitcoin-subsection-oracle/bitcoin-subsection-oracle.component';
import {BitcoinSubsectionOracleControlComponent} from './components/bitcoin-subsection-oracle-control/bitcoin-subsection-oracle-control.component';
import {BitcoinSubsectionOracleChartComponent} from './components/bitcoin-subsection-oracle-chart/bitcoin-subsection-oracle-chart.component';
import {BitcoinSubsectionOracleFormComponent} from './components/bitcoin-subsection-oracle-form/bitcoin-subsection-oracle-form.component';
import {BitcoinSubsectionOracleRunComponent} from './components/bitcoin-subsection-oracle-run/bitcoin-subsection-oracle-run.component';
import {BitcoinSubsectionOracleRunProgressDateComponent} from './components/bitcoin-subsection-oracle-run-progress-date/bitcoin-subsection-oracle-run-progress-date.component';
import {BitcoinSubsectionOracleRunProgressSummaryComponent} from './components/bitcoin-subsection-oracle-run-progress-summary/bitcoin-subsection-oracle-run-progress-summary.component';

@NgModule({
	declarations: [
		BitcoinSubsectionOracleComponent,
		BitcoinSubsectionOracleControlComponent,
		BitcoinSubsectionOracleChartComponent,
		BitcoinSubsectionOracleFormComponent,
		BitcoinSubsectionOracleRunComponent,
		BitcoinSubsectionOracleRunProgressDateComponent,
		BitcoinSubsectionOracleRunProgressSummaryComponent,
	],
	imports: [
		CoreRouterModule.forChild([
			{
				path: '',
				component: BitcoinSubsectionOracleComponent,
			},
		]),
		CoreCommonModule,
		CoreReactiveFormsModule,
		MatIconModule,
		MatButtonModule,
		MatFormFieldModule,
		MatDatepickerModule,
		MatInputModule,
		MatCardModule,
		MatProgressBarModule,
		ChartJsBaseChartDirective,
		OrcTimeModule,
		OrcFormModule,
		OrcGraphicModule,
		OrcProgressModule,
	],
	providers: [
		provideLuxonDateAdapter(),
		{
			provide: MAT_LUXON_DATE_ADAPTER_OPTIONS,
			useValue: {
				useUtc: true,
			},
		},
	],
	exports: [],
})
export class OrcBitcoinSubsectionOracleModule {}
