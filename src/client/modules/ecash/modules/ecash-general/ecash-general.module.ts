/* Core Dependencies */
import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ReactiveFormsModule} from '@angular/forms';
/* Vendor Dependencies */
import {MatIconModule} from '@angular/material/icon';
import {MatCardModule} from '@angular/material/card';
import {MatRippleModule} from '@angular/material/core';
import {MatButtonModule} from '@angular/material/button';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
/* Application Dependencies */
import {OrcLocalModule} from '@client/modules/local/local.module';
import {OrcGraphicModule} from '@client/modules/graphic/graphic.module';
import {OrcFormModule} from '@client/modules/form/form.module';
/* Local Dependencies */
import {EcashGeneralNoteComponent} from './components/ecash-general-note/ecash-general-note.component';
import {EcashGeneralBalanceComponent} from './components/ecash-general-balance/ecash-general-balance.component';
import {EcashGeneralMintsComponent} from './components/ecash-general-mints/ecash-general-mints.component';
import {EcashGeneralMintIconComponent} from './components/ecash-general-mint-icon/ecash-general-mint-icon.component';
import {EcashGeneralActionsComponent} from './components/ecash-general-actions/ecash-general-actions.component';
import {EcashGeneralIssueComponent} from './components/ecash-general-issue/ecash-general-issue.component';
import {EcashGeneralUnitChipsComponent} from './components/ecash-general-unit-chips/ecash-general-unit-chips.component';

@NgModule({
	declarations: [
		EcashGeneralNoteComponent,
		EcashGeneralBalanceComponent,
		EcashGeneralMintsComponent,
		EcashGeneralMintIconComponent,
		EcashGeneralActionsComponent,
		EcashGeneralIssueComponent,
		EcashGeneralUnitChipsComponent,
	],
	imports: [
		CommonModule,
		ReactiveFormsModule,
		MatIconModule,
		MatCardModule,
		MatRippleModule,
		MatButtonModule,
		MatFormFieldModule,
		MatInputModule,
		OrcLocalModule,
		OrcGraphicModule,
		OrcFormModule,
	],
	exports: [EcashGeneralNoteComponent, EcashGeneralBalanceComponent, EcashGeneralMintsComponent, EcashGeneralActionsComponent],
})
export class OrcEcashGeneralModule {}
