/* Core Dependencies */
import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
/* Vendor Dependencies */
import {MatIconModule} from '@angular/material/icon';
import {MatRippleModule} from '@angular/material/core';
/* Application Dependencies */
import {OrcLocalModule} from '@client/modules/local/local.module';
import {OrcGraphicModule} from '@client/modules/graphic/graphic.module';
/* Local Dependencies */
import {CashuUnitChipsComponent} from './components/cashu-unit-chips/cashu-unit-chips.component';
import {CashuMethodChipsComponent} from './components/cashu-method-chips/cashu-method-chips.component';
import {CashuPaymentMethodComponent} from './components/cashu-payment-method/cashu-payment-method.component';
import {CashuLimitsComponent} from './components/cashu-limits/cashu-limits.component';
import {CashuMethodIconComponent} from './components/cashu-method-icon/cashu-method-icon.component';

@NgModule({
	declarations: [
		CashuUnitChipsComponent,
		CashuMethodChipsComponent,
		CashuPaymentMethodComponent,
		CashuLimitsComponent,
		CashuMethodIconComponent,
	],
	imports: [CommonModule, MatIconModule, MatRippleModule, OrcLocalModule, OrcGraphicModule],
	exports: [
		CashuUnitChipsComponent,
		CashuMethodChipsComponent,
		CashuPaymentMethodComponent,
		CashuLimitsComponent,
		CashuMethodIconComponent,
	],
})
export class OrcCashuModule {}
