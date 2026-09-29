/* Core Dependencies */
import {NgModule} from '@angular/core';
import {CommonModule as CoreCommonModule} from '@angular/common';
import {RouterModule as CoreRouterModule} from '@angular/router';
import {ReactiveFormsModule as CoreReactiveFormsModule} from '@angular/forms';
/* Vendor Dependencies */
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatCardModule} from '@angular/material/card';
import {MatSelectModule} from '@angular/material/select';
import {MatDatepickerModule} from '@angular/material/datepicker';
import {MatAutocompleteModule} from '@angular/material/autocomplete';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatTableModule} from '@angular/material/table';
import {MatSortModule} from '@angular/material/sort';
import {MatRippleModule} from '@angular/material/core';
import {MatDialogModule} from '@angular/material/dialog';
import {MatTooltipModule} from '@angular/material/tooltip';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {MatMenuModule} from '@angular/material/menu';
/* Application Dependencies */
import {OrcFormModule} from '@client/modules/form/form.module';
import {OrcLocalModule} from '@client/modules/local/local.module';
import {OrcCrewModule} from '@client/modules/crew/crew.module';
import {OrcButtonModule} from '@client/modules/button/button.module';
import {OrcGraphicModule} from '@client/modules/graphic/graphic.module';
/* Local Dependencies */
import {IndexSubsectionCrewComponent} from './components/index-subsection-crew/index-subsection-crew.component';
import {IndexSubsectionCrewControlComponent} from './components/index-subsection-crew-control/index-subsection-crew-control.component';
import {IndexSubsectionCrewFormInviteComponent} from './components/index-subsection-crew-form-invite/index-subsection-crew-form-invite.component';
import {IndexSubsectionCrewTableComponent} from './components/index-subsection-crew-table/index-subsection-crew-table.component';
import {IndexSubsectionCrewTableInviteComponent} from './components/index-subsection-crew-table-invite/index-subsection-crew-table-invite.component';
import {IndexSubsectionCrewFormUserComponent} from './components/index-subsection-crew-form-user/index-subsection-crew-form-user.component';
import {IndexSubsectionCrewDialogUserComponent} from './components/index-subsection-crew-dialog-user/index-subsection-crew-dialog-user.component';
import {IndexSubsectionCrewDialogInviteComponent} from './components/index-subsection-crew-dialog-invite/index-subsection-crew-dialog-invite.component';
import {IndexSubsectionCrewTableUserComponent} from './components/index-subsection-crew-table-user/index-subsection-crew-table-user.component';

@NgModule({
	declarations: [
		IndexSubsectionCrewComponent,
		IndexSubsectionCrewControlComponent,
		IndexSubsectionCrewFormInviteComponent,
		IndexSubsectionCrewTableComponent,
		IndexSubsectionCrewTableInviteComponent,
		IndexSubsectionCrewFormUserComponent,
		IndexSubsectionCrewDialogUserComponent,
		IndexSubsectionCrewDialogInviteComponent,
		IndexSubsectionCrewTableUserComponent,
	],
	imports: [
		[
			CoreRouterModule.forChild([
				{
					path: '',
					component: IndexSubsectionCrewComponent,
				},
			]),
		],
		CoreCommonModule,
		CoreReactiveFormsModule,
		MatButtonModule,
		MatIconModule,
		MatFormFieldModule,
		MatInputModule,
		MatCardModule,
		MatSelectModule,
		MatDatepickerModule,
		MatAutocompleteModule,
		MatCheckboxModule,
		MatTableModule,
		MatSortModule,
		MatRippleModule,
		MatDialogModule,
		MatTooltipModule,
		MatSlideToggleModule,
		MatMenuModule,
		OrcFormModule,
		OrcLocalModule,
		OrcCrewModule,
		OrcButtonModule,
		OrcGraphicModule,
	],
})
export class OrcIndexSubsectionCrewModule {}
