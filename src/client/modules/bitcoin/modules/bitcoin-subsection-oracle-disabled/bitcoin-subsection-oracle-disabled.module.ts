/* Core Dependencies */
import {NgModule} from '@angular/core';
import {CommonModule as CoreCommonModule} from '@angular/common';
import {RouterModule as CoreRouterModule} from '@angular/router';
/* Vendor Dependencies */
import {MatIconModule} from '@angular/material/icon';
/* Application Dependencies */
import {OrcPublicModule} from '@client/modules/public/public.module';
/* Local Dependencies */
import {BitcoinSubsectionOracleDisabledComponent} from './components/bitcoin-subsection-oracle-disabled/bitcoin-subsection-oracle-disabled.component';

@NgModule({
	declarations: [BitcoinSubsectionOracleDisabledComponent],
	imports: [
		CoreRouterModule.forChild([
			{
				path: '',
				component: BitcoinSubsectionOracleDisabledComponent,
			},
		]),
		CoreCommonModule,
		MatIconModule,
		OrcPublicModule,
	],
	exports: [],
})
export class OrcBitcoinSubsectionOracleDisabledModule {}
