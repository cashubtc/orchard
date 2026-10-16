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
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
/* Application Dependencies */
import {OrcLocalModule} from '@client/modules/local/local.module';
import {OrcGraphicModule} from '@client/modules/graphic/graphic.module';
import {OrcFormModule} from '@client/modules/form/form.module';
import {OrcNetworkModule} from '@client/modules/network/network.module';
import {OrcButtonModule} from '@client/modules/button/button.module';
import {OrcCashuModule} from '@client/modules/cashu/cashu.module';
/* Local Dependencies */
import {EcashGeneralNoteComponent} from './components/ecash-general-note/ecash-general-note.component';
import {EcashGeneralBalanceComponent} from './components/ecash-general-balance/ecash-general-balance.component';
import {EcashGeneralMintsComponent} from './components/ecash-general-mints/ecash-general-mints.component';
import {EcashGeneralMintIconComponent} from './components/ecash-general-mint-icon/ecash-general-mint-icon.component';
import {EcashGeneralActionsComponent} from './components/ecash-general-actions/ecash-general-actions.component';
import {EcashGeneralIssueComponent} from './components/ecash-general-issue/ecash-general-issue.component';
import {EcashGeneralSolvencyComponent} from './components/ecash-general-solvency/ecash-general-solvency.component';
import {EcashGeneralMintComponent} from './components/ecash-general-mint/ecash-general-mint.component';
import {EcashGeneralAmountHeroComponent} from './components/ecash-general-amount-hero/ecash-general-amount-hero.component';
import {EcashGeneralMintChipComponent} from './components/ecash-general-mint-chip/ecash-general-mint-chip.component';
import {EcashGeneralUnitPickerComponent} from './components/ecash-general-unit-picker/ecash-general-unit-picker.component';
import {EcashGeneralBalanceAmountComponent} from './components/ecash-general-balance-amount/ecash-general-balance-amount.component';
import {EcashGeneralActivityComponent} from './components/ecash-general-activity/ecash-general-activity.component';
import {EcashGeneralMintInfoComponent} from './components/ecash-general-mint-info/ecash-general-mint-info.component';
import {EcashGeneralMintAddComponent} from './components/ecash-general-mint-add/ecash-general-mint-add.component';
import {EcashGeneralMintHeaderComponent} from './components/ecash-general-mint-header/ecash-general-mint-header.component';
import {EcashGeneralMintDetailsComponent} from './components/ecash-general-mint-details/ecash-general-mint-details.component';

@NgModule({
	declarations: [
		EcashGeneralNoteComponent,
		EcashGeneralBalanceComponent,
		EcashGeneralMintsComponent,
		EcashGeneralMintIconComponent,
		EcashGeneralActionsComponent,
		EcashGeneralIssueComponent,
		EcashGeneralSolvencyComponent,
		EcashGeneralMintComponent,
		EcashGeneralAmountHeroComponent,
		EcashGeneralMintChipComponent,
		EcashGeneralUnitPickerComponent,
		EcashGeneralBalanceAmountComponent,
		EcashGeneralActivityComponent,
		EcashGeneralMintInfoComponent,
		EcashGeneralMintAddComponent,
		EcashGeneralMintHeaderComponent,
		EcashGeneralMintDetailsComponent,
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
		MatProgressSpinnerModule,
		OrcLocalModule,
		OrcGraphicModule,
		OrcFormModule,
		OrcNetworkModule,
		OrcButtonModule,
		OrcCashuModule,
	],
	exports: [
		EcashGeneralNoteComponent,
		EcashGeneralBalanceComponent,
		EcashGeneralMintsComponent,
		EcashGeneralActionsComponent,
		EcashGeneralActivityComponent,
	],
})
export class OrcEcashGeneralModule {}
