/* Core Dependencies */
import {NgModule} from '@angular/core';
import {CommonModule as CoreCommonModule} from '@angular/common';
import {RouterModule as CoreRouterModule} from '@angular/router';
/* Vendor Dependencies */
import {MatCardModule} from '@angular/material/card';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
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
		MatCardModule,
		MatButtonModule,
		MatIconModule,
	],
	exports: [],
})
export class OrcBitcoinSubsectionOracleDisabledModule {}
