/* Core Dependencies */
import {NgModule} from '@angular/core';
/* Vendor Dependencies */
import {MatIconModule} from '@angular/material/icon';
import {MatCardModule} from '@angular/material/card';
import {MatRippleModule} from '@angular/material/core';
/* Application Dependencies */
import {OrcLocalModule} from '@client/modules/local/local.module';
import {OrcGraphicModule} from '@client/modules/graphic/graphic.module';
/* Local Dependencies */
import {EcashGeneralNoteComponent} from './components/ecash-general-note/ecash-general-note.component';
import {EcashGeneralBalanceComponent} from './components/ecash-general-balance/ecash-general-balance.component';
import {EcashGeneralMintsComponent} from './components/ecash-general-mints/ecash-general-mints.component';
import {EcashGeneralMintIconComponent} from './components/ecash-general-mint-icon/ecash-general-mint-icon.component';
import {EcashGeneralActionsComponent} from './components/ecash-general-actions/ecash-general-actions.component';

@NgModule({
	declarations: [
		EcashGeneralNoteComponent,
		EcashGeneralBalanceComponent,
		EcashGeneralMintsComponent,
		EcashGeneralMintIconComponent,
		EcashGeneralActionsComponent,
	],
	imports: [MatIconModule, MatCardModule, MatRippleModule, OrcLocalModule, OrcGraphicModule],
	exports: [EcashGeneralNoteComponent, EcashGeneralBalanceComponent, EcashGeneralMintsComponent, EcashGeneralActionsComponent],
})
export class OrcEcashGeneralModule {}
