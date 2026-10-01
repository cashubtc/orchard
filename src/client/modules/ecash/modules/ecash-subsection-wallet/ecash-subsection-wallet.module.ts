/* Core Dependencies */
import {NgModule} from '@angular/core';
import {RouterModule as CoreRouterModule} from '@angular/router';
/* Native Dependencies */
import {OrcEcashGeneralModule} from '@client/modules/ecash/modules/ecash-general/ecash-general.module';
/* Local Dependencies */
import {EcashSubsectionWalletComponent} from './components/ecash-subsection-wallet/ecash-subsection-wallet.component';

@NgModule({
	declarations: [EcashSubsectionWalletComponent],
	imports: [
		CoreRouterModule.forChild([
			{
				path: '',
				component: EcashSubsectionWalletComponent,
			},
		]),
		OrcEcashGeneralModule,
	],
	exports: [],
})
export class OrcEcashSubsectionWalletModule {}
