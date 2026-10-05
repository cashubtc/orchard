/* Core Dependencies */
import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
/* Vendor Dependencies */
import {MatIconModule} from '@angular/material/icon';
import {MatCardModule} from '@angular/material/card';
import {MatTableModule} from '@angular/material/table';
import {MatButtonModule} from '@angular/material/button';
import {MatRippleModule} from '@angular/material/core';
import {MatChipsModule} from '@angular/material/chips';
import {MatMenuModule} from '@angular/material/menu';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatProgressSpinnerModule} from '@angular/material/progress-spinner';
import {BaseChartDirective as ChartJsBaseChartDirective} from 'ng2-charts';
/* Application Dependencies */
import {OrcNetworkModule} from '@client/modules/network/network.module';
import {OrcGraphicModule} from '@client/modules/graphic/graphic.module';
import {OrcLocalModule} from '@client/modules/local/local.module';
import {OrcErrorModule} from '@client/modules/error/error.module';
import {OrcTimeModule} from '@client/modules/time/time.module';
import {OrcDataModule} from '@client/modules/data/data.module';
import {OrcProgressModule} from '@client/modules/progress/progress.module';
/* Local Dependencies */
import {MintGeneralIconComponent} from './components/mint-general-icon/mint-general-icon.component';
import {MintGeneralNameComponent} from './components/mint-general-name/mint-general-name.component';
import {MintGeneralKeysetComponent} from './components/mint-general-keyset/mint-general-keyset.component';
import {MintGeneralBalanceSheetComponent} from './components/mint-general-balance-sheet/mint-general-balance-sheet.component';
import {MintGeneralInfoComponent} from './components/mint-general-info/mint-general-info.component';
import {MintGeneralBalanceStacksComponent} from './components/mint-general-balance-stacks/mint-general-balance-stacks.component';
import {MintGeneralKeysetVersionComponent} from './components/mint-general-keyset-version/mint-general-keyset-version.component';
import {MintGeneralConfigComponent} from './components/mint-general-config/mint-general-config.component';
import {MintGeneralPaymentMethodComponent} from './components/mint-general-payment-method/mint-general-payment-method.component';
import {MintGeneralKeysetsComponent} from './components/mint-general-keysets/mint-general-keysets.component';
import {MintGeneralActivityComponent} from './components/mint-general-activity/mint-general-activity.component';

@NgModule({
	declarations: [
		MintGeneralIconComponent,
		MintGeneralNameComponent,
		MintGeneralKeysetComponent,
		MintGeneralBalanceSheetComponent,
		MintGeneralInfoComponent,
		MintGeneralBalanceStacksComponent,
		MintGeneralKeysetVersionComponent,
		MintGeneralConfigComponent,
		MintGeneralPaymentMethodComponent,
		MintGeneralKeysetsComponent,
		MintGeneralActivityComponent,
	],
	imports: [
		CommonModule,
		MatIconModule,
		MatCardModule,
		MatTableModule,
		MatButtonModule,
		MatRippleModule,
		MatChipsModule,
		MatMenuModule,
		MatCheckboxModule,
		MatProgressSpinnerModule,
		ChartJsBaseChartDirective,
		OrcNetworkModule,
		OrcGraphicModule,
		OrcLocalModule,
		OrcErrorModule,
		OrcTimeModule,
		OrcDataModule,
		OrcProgressModule,
	],
	exports: [
		MintGeneralIconComponent,
		MintGeneralNameComponent,
		MintGeneralKeysetComponent,
		MintGeneralBalanceSheetComponent,
		MintGeneralInfoComponent,
		MintGeneralKeysetVersionComponent,
		MintGeneralConfigComponent,
		MintGeneralPaymentMethodComponent,
		MintGeneralKeysetsComponent,
		MintGeneralActivityComponent,
	],
})
export class OrcMintGeneralModule {}
