/* Core Dependencies */
import {NgModule} from '@angular/core';
import {CommonModule as CoreCommonModule} from '@angular/common';
import {RouterModule as CoreRouterModule} from '@angular/router';
/* Vendor Dependencies */
import {MatIconModule} from '@angular/material/icon';
/* Application Dependencies */
import {OrcNavModule} from '@client/modules/nav/nav.module';
/* Local Dependencies */
import {EcashSectionComponent} from './components/ecash-section/ecash-section.component';

@NgModule({
	declarations: [EcashSectionComponent],
	imports: [
		CoreRouterModule.forChild([
			{
				path: '',
				component: EcashSectionComponent,
				data: {
					section: 'ecash',
				},
				children: [
					{
						path: '',
						loadChildren: () =>
							import('@client/modules/ecash/modules/ecash-subsection-wallet/ecash-subsection-wallet.module').then(
								(m) => m.OrcEcashSubsectionWalletModule,
							),
						title: 'Orchard | Ecash',
						data: {
							section: 'ecash',
							sub_section: 'wallet',
						},
					},
				],
			},
		]),
		CoreCommonModule,
		MatIconModule,
		OrcNavModule,
	],
})
export class OrcEcashSectionModule {}
