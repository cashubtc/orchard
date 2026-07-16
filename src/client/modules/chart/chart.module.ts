/* Core Dependencies */
import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
/* Vendor Dependencies */
import {BaseChartDirective} from 'ng2-charts';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatTableModule} from '@angular/material/table';
/* Local Dependencies */
import {ChartGraphicBarsComponent} from './components/chart-graphic-bars/chart-graphic-bars.component';
import {ChartLegendComponent} from './components/chart-legend/chart-legend.component';
import {ChartGaugeComponent} from './components/chart-gauge/chart-gauge.component';
import {ChartPieComponent} from './components/chart-pie/chart-pie.component';

@NgModule({
	declarations: [ChartGraphicBarsComponent, ChartLegendComponent, ChartGaugeComponent, ChartPieComponent],
	imports: [CommonModule, BaseChartDirective, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatTableModule],
	exports: [ChartGraphicBarsComponent, ChartLegendComponent, ChartGaugeComponent, ChartPieComponent],
})
export class OrcChartModule {}
