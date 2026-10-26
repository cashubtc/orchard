/* Core Dependencies */
import {NgModule} from '@angular/core';
import {CommonModule as CoreCommonModule} from '@angular/common';
import {RouterModule as CoreRouterModule} from '@angular/router';
import {ReactiveFormsModule as CoreReactiveFormsModule} from '@angular/forms';
/* Vendor Dependencies */
import {MatCardModule} from '@angular/material/card';
import {MatIconModule} from '@angular/material/icon';
import {MatRippleModule} from '@angular/material/core';
import {MatButtonModule} from '@angular/material/button';
import {MatTableModule} from '@angular/material/table';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatSelectModule} from '@angular/material/select';
import {MatMenuModule} from '@angular/material/menu';
import {MatListModule} from '@angular/material/list';
/* Application Dependencies */
import {firstRunGuard} from '@client/modules/onboarding/guards/first-run.guard';
import {OrcLocalModule} from '@client/modules/local/local.module';
import {OrcDataModule} from '@client/modules/data/data.module';
import {OrcGraphicModule} from '@client/modules/graphic/graphic.module';
import {OrcErrorModule} from '@client/modules/error/error.module';
import {OrcNavModule} from '@client/modules/nav/nav.module';
import {OrcProgressModule} from '@client/modules/progress/progress.module';
import {OrcBitcoinGeneralModule} from '@client/modules/bitcoin/modules/bitcoin-general/bitcoin-general.module';
import {OrcBitcoinGeneralBlockPipeModule} from '@client/modules/bitcoin/modules/bitcoin-general/bitcoin-general-block-pipe.module';
import {OrcLightningGeneralModule} from '@client/modules/lightning/modules/lightning-general/lightning-general.module';
import {OrcMintGeneralModule} from '@client/modules/mint/modules/mint-general/mint-general.module';
/* Local Dependencies */
import {IndexSubsectionDashboardComponent} from './components/index-subsection-dashboard/index-subsection-dashboard.component';
import {IndexSubsectionDashboardBitcoinHeaderComponent} from './components/index-subsection-dashboard-bitcoin-header/index-subsection-dashboard-bitcoin-header.component';
import {IndexSubsectionDashboardBitcoinDisabledComponent} from './components/index-subsection-dashboard-bitcoin-disabled/index-subsection-dashboard-bitcoin-disabled.component';
import {IndexSubsectionDashboardBitcoinEnabledComponent} from './components/index-subsection-dashboard-bitcoin-enabled/index-subsection-dashboard-bitcoin-enabled.component';
import {IndexSubsectionDashboardBitcoinEnabledBlockchainComponent} from './components/index-subsection-dashboard-bitcoin-enabled-blockchain/index-subsection-dashboard-bitcoin-enabled-blockchain.component';
import {IndexSubsectionDashboardBitcoinEnabledSyncingComponent} from './components/index-subsection-dashboard-bitcoin-enabled-syncing/index-subsection-dashboard-bitcoin-enabled-syncing.component';
import {IndexSubsectionDashboardLightningHeaderComponent} from './components/index-subsection-dashboard-lightning-header/index-subsection-dashboard-lightning-header.component';
import {IndexSubsectionDashboardLightningDisabledComponent} from './components/index-subsection-dashboard-lightning-disabled/index-subsection-dashboard-lightning-disabled.component';
import {IndexSubsectionDashboardLightningEnabledComponent} from './components/index-subsection-dashboard-lightning-enabled/index-subsection-dashboard-lightning-enabled.component';
import {IndexSubsectionDashboardLightningEnabledInfoComponent} from './components/index-subsection-dashboard-lightning-enabled-info/index-subsection-dashboard-lightning-enabled-info.component';
import {IndexSubsectionDashboardMintHeaderComponent} from './components/index-subsection-dashboard-mint-header/index-subsection-dashboard-mint-header.component';
import {IndexSubsectionDashboardMintEnabledComponent} from './components/index-subsection-dashboard-mint-enabled/index-subsection-dashboard-mint-enabled.component';
import {IndexSubsectionDashboardMintDisabledComponent} from './components/index-subsection-dashboard-mint-disabled/index-subsection-dashboard-mint-disabled.component';
import {IndexSubsectionDashboardEcashHeaderComponent} from './components/index-subsection-dashboard-ecash-header/index-subsection-dashboard-ecash-header.component';
import {IndexSubsectionDashboardEcashDisabledComponent} from './components/index-subsection-dashboard-ecash-disabled/index-subsection-dashboard-ecash-disabled.component';
import {IndexSubsectionDashboardEcashEnabledComponent} from './components/index-subsection-dashboard-ecash-enabled/index-subsection-dashboard-ecash-enabled.component';

@NgModule({
	declarations: [
		IndexSubsectionDashboardComponent,
		IndexSubsectionDashboardBitcoinHeaderComponent,
		IndexSubsectionDashboardBitcoinDisabledComponent,
		IndexSubsectionDashboardBitcoinEnabledComponent,
		IndexSubsectionDashboardBitcoinEnabledBlockchainComponent,
		IndexSubsectionDashboardBitcoinEnabledSyncingComponent,
		IndexSubsectionDashboardLightningHeaderComponent,
		IndexSubsectionDashboardLightningDisabledComponent,
		IndexSubsectionDashboardLightningEnabledComponent,
		IndexSubsectionDashboardLightningEnabledInfoComponent,
		IndexSubsectionDashboardMintHeaderComponent,
		IndexSubsectionDashboardMintDisabledComponent,
		IndexSubsectionDashboardMintEnabledComponent,
		IndexSubsectionDashboardEcashHeaderComponent,
		IndexSubsectionDashboardEcashEnabledComponent,
		IndexSubsectionDashboardEcashDisabledComponent,
	],
	imports: [
		[
			CoreRouterModule.forChild([
				{
					path: '',
					canMatch: [firstRunGuard],
					loadComponent: () =>
						import('@client/modules/onboarding/components/first-run-empty/first-run-empty.component').then(
							(m) => m.FirstRunEmptyComponent,
						),
				},
				{
					path: '',
					component: IndexSubsectionDashboardComponent,
				},
			]),
		],
		CoreCommonModule,
		CoreReactiveFormsModule,
		MatCardModule,
		MatIconModule,
		MatRippleModule,
		MatButtonModule,
		MatTableModule,
		MatProgressSpinnerModule,
		MatFormFieldModule,
		MatSelectModule,
		MatMenuModule,
		MatListModule,
		OrcLocalModule,
		OrcDataModule,
		OrcGraphicModule,
		OrcErrorModule,
		OrcNavModule,
		OrcProgressModule,
		OrcMintGeneralModule,
		OrcBitcoinGeneralModule,
		OrcBitcoinGeneralBlockPipeModule,
		OrcLightningGeneralModule,
	],
})
export class OrcIndexSubsectionDashboardModule {}
