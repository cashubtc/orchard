/* Core Dependencies */
import {NgModule} from '@angular/core';
/* Vendor Dependencies */
import {MatIconModule} from '@angular/material/icon';
import {MatCardModule} from '@angular/material/card';
/* Application Dependencies */
import {OrcLocalModule} from '@client/modules/local/local.module';
import {OrcGraphicModule} from '@client/modules/graphic/graphic.module';
/* Local Dependencies */
import {EcashGeneralNoteComponent} from './components/ecash-general-note/ecash-general-note.component';
import {EcashGeneralBalanceComponent} from './components/ecash-general-balance/ecash-general-balance.component';

@NgModule({
	declarations: [EcashGeneralNoteComponent, EcashGeneralBalanceComponent],
	imports: [MatIconModule, MatCardModule, OrcLocalModule, OrcGraphicModule],
	exports: [EcashGeneralNoteComponent, EcashGeneralBalanceComponent],
})
export class OrcEcashGeneralModule {}
