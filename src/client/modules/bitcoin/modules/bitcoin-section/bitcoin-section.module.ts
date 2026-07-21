/* Core Dependencies */
import {NgModule} from '@angular/core';
import {CommonModule as CoreCommonModule} from '@angular/common';
import {RouterModule as CoreRouterModule} from '@angular/router';
/* Vendor Dependencies */
import {MatIconModule} from '@angular/material/icon';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
/* Application Dependencies */
import {OrcNavModule} from '@client/modules/nav/nav.module';
import {enabledGuard} from '@client/modules/routing/guards/enabled/enabled.guard';
import {bitcoinOracleGuard} from '@client/modules/routing/guards/bitcoin-oracle/bitcoin-oracle.guard';
import {provideChartConfig} from '@client/modules/chart/chart.providers';
/* Native Dependencies */
import {BitcoinSectionComponent} from './components/bitcoin-section/bitcoin-section.component';

@NgModule({
	declarations: [BitcoinSectionComponent],
	imports: [
		CoreRouterModule.forChild([
			{
				path: '',
				component: BitcoinSectionComponent,
				data: {
					section: 'bitcoin',
				},
				children: [
					{
						path: '',
						loadChildren: () =>
							import('@client/modules/bitcoin/modules/bitcoin-subsection-dashboard/bitcoin-subsection-dashboard.module').then(
								(m) => m.OrcBitcoinSubsectionDashboardModule,
							),
						title: 'Orchard | Bitcoin',
						canActivate: [enabledGuard],
						data: {
							section: 'bitcoin',
							sub_section: 'dashboard',
						},
					},
					{
						path: 'oracle',
						canMatch: [bitcoinOracleGuard],
						loadChildren: () =>
							import('@client/modules/bitcoin/modules/bitcoin-subsection-oracle/bitcoin-subsection-oracle.module').then(
								(m) => m.OrcBitcoinSubsectionOracleModule,
							),
						title: 'Orchard | Bitcoin Oracle',
						canActivate: [enabledGuard],
						data: {
							section: 'bitcoin',
							sub_section: 'oracle',
						},
					},
					{
						// Fallback when the bitcoin_oracle setting is disabled: render the stub with a link to app settings
						path: 'oracle',
						loadChildren: () =>
							import('@client/modules/bitcoin/modules/bitcoin-subsection-oracle-disabled/bitcoin-subsection-oracle-disabled.module').then(
								(m) => m.OrcBitcoinSubsectionOracleDisabledModule,
							),
						title: 'Orchard | Bitcoin Oracle',
						canActivate: [enabledGuard],
						data: {
							section: 'bitcoin',
							sub_section: 'oracle',
						},
					},
				],
			},
			{
				path: 'disabled',
				loadChildren: () =>
					import('@client/modules/bitcoin/modules/bitcoin-subsection-disabled/bitcoin-subsection-disabled.module').then(
						(m) => m.OrcBitcoinSubsectionDisabledModule,
					),
				title: 'Orchard | Bitcoin Disabled',
				data: {
					section: 'bitcoin',
					sub_section: 'disabled',
				},
			},
		]),
		CoreCommonModule,
		MatIconModule,
		MatProgressSpinnerModule,
		OrcNavModule,
	],
	providers: [provideChartConfig()],
})
export class OrcBitcoinSectionModule {}
