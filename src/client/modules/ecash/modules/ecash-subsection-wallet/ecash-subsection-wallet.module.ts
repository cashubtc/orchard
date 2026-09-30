/* Core Dependencies */
import {NgModule} from '@angular/core';
import {RouterModule as CoreRouterModule} from '@angular/router';
/* Vendor Dependencies */
import {MatIconModule} from '@angular/material/icon';
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
		MatIconModule,
	],
	exports: [],
})
export class OrcEcashSubsectionWalletModule {}
