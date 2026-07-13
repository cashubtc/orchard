/* Core Dependencies */
import {NgModule} from '@angular/core';
import {CommonModule as CoreCommonModule} from '@angular/common';
import {ReactiveFormsModule as CoreReactiveFormsModule} from '@angular/forms';
/* Vendor Dependencies */
import {MatIconModule} from '@angular/material/icon';
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
import {SystemControlComponent} from './components/system-control/system-control.component';
import {SystemChartComponent} from './components/system-chart/system-chart.component';

@NgModule({
	declarations: [SystemControlComponent, SystemChartComponent],
	imports: [
		CoreCommonModule,
		CoreReactiveFormsModule,
		MatIconModule,
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
	exports: [SystemControlComponent, SystemChartComponent],
})
export class OrcSystemModule {}
