/* Core Dependencies */
import {NgModule} from '@angular/core';
import {CommonModule as CoreCommonModule} from '@angular/common';
import {ReactiveFormsModule as CoreReactiveFormsModule} from '@angular/forms';
import {RouterModule as CoreRouterModule} from '@angular/router';
/* Vendor Dependencies */
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatIconModule} from '@angular/material/icon';
import {MatMenuModule} from '@angular/material/menu';
import {MatCardModule} from '@angular/material/card';
import {MatTableModule} from '@angular/material/table';
import {MatSortModule} from '@angular/material/sort';
import {MatPaginatorModule} from '@angular/material/paginator';
import {MatRippleModule} from '@angular/material/core';
import {MatButtonModule} from '@angular/material/button';
import {MatTooltipModule} from '@angular/material/tooltip';
import {MatDialogModule} from '@angular/material/dialog';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {BaseChartDirective as ChartJsBaseChartDirective} from 'ng2-charts';
/* Application Dependencies */
import {OrcLocalModule} from '@client/modules/local/local.module';
import {OrcDataModule} from '@client/modules/data/data.module';
import {OrcFormModule} from '@client/modules/form/form.module';
import {OrcGraphicModule} from '@client/modules/graphic/graphic.module';
import {OrcProgressModule} from '@client/modules/progress/progress.module';
import {OrcButtonModule} from '@client/modules/button/button.module';
import {OrcTimeModule} from '@client/modules/time/time.module';
import {OrcMintGeneralModule} from '@client/modules/mint/modules/mint-general/mint-general.module';
import {OrcEcashGeneralModule} from '@client/modules/ecash/modules/ecash-general/ecash-general.module';
import {pendingEventGuard} from '@client/modules/event/guards/pending-event.guard';
/* Local Dependencies */
import {MintSubsectionDatabaseComponent} from './components/mint-subsection-database/mint-subsection-database.component';
import {MintSubsectionDatabaseControlComponent} from './components/mint-subsection-database-control/mint-subsection-database-control.component';
import {MintSubsectionDatabaseFormBackupComponent} from './components/mint-subsection-database-form-backup/mint-subsection-database-form-backup.component';
import {MintSubsectionDatabaseFormRestoreComponent} from './components/mint-subsection-database-form-restore/mint-subsection-database-form-restore.component';
import {MintSubsectionDatabaseChartComponent} from './components/mint-subsection-database-chart/mint-subsection-database-chart.component';
import {MintSubsectionDatabaseChartLegendComponent} from './components/mint-subsection-database-chart-legend/mint-subsection-database-chart-legend.component';
import {MintSubsectionDatabaseTableComponent} from './components/mint-subsection-database-table/mint-subsection-database-table.component';
import {MintSubsectionDatabaseTableMintComponent} from './components/mint-subsection-database-table-mint/mint-subsection-database-table-mint.component';
import {MintSubsectionDatabaseTableMintReusableComponent} from './components/mint-subsection-database-table-mint-reusable/mint-subsection-database-table-mint-reusable.component';
import {MintSubsectionDatabaseTableMeltComponent} from './components/mint-subsection-database-table-melt/mint-subsection-database-table-melt.component';
import {MintSubsectionDatabaseDialogQuoteComponent} from './components/mint-subsection-database-dialog-quote/mint-subsection-database-dialog-quote.component';
import {MintSubsectionDatabaseTableSwapComponent} from './components/mint-subsection-database-table-swap/mint-subsection-database-table-swap.component';

@NgModule({
	declarations: [
		MintSubsectionDatabaseComponent,
		MintSubsectionDatabaseControlComponent,
		MintSubsectionDatabaseFormBackupComponent,
		MintSubsectionDatabaseFormRestoreComponent,
		MintSubsectionDatabaseChartComponent,
		MintSubsectionDatabaseChartLegendComponent,
		MintSubsectionDatabaseTableComponent,
		MintSubsectionDatabaseTableMintComponent,
		MintSubsectionDatabaseTableMintReusableComponent,
		MintSubsectionDatabaseTableMeltComponent,
		MintSubsectionDatabaseDialogQuoteComponent,
		MintSubsectionDatabaseTableSwapComponent,
	],
	imports: [
		CoreRouterModule.forChild([
			{
				path: '',
				component: MintSubsectionDatabaseComponent,
				canDeactivate: [pendingEventGuard],
			},
		]),
		CoreCommonModule,
		CoreReactiveFormsModule,
		MatFormFieldModule,
		MatInputModule,
		MatSelectModule,
		MatDatepickerModule,
		MatIconModule,
		MatMenuModule,
		MatCardModule,
		MatTableModule,
		MatSortModule,
		MatPaginatorModule,
		MatRippleModule,
		MatTooltipModule,
		MatDialogModule,
		MatCheckboxModule,
		MatButtonModule,
		ChartJsBaseChartDirective,
		OrcLocalModule,
		OrcDataModule,
		OrcFormModule,
		OrcGraphicModule,
		OrcProgressModule,
		OrcButtonModule,
		OrcTimeModule,
		OrcMintGeneralModule,
		OrcEcashGeneralModule,
	],
	exports: [],
})
export class OrcMintSubsectionDatabaseModule {}
