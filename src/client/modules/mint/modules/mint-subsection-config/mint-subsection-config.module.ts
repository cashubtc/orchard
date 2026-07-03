/* Core Dependencies */
import {NgModule} from '@angular/core';
import {CommonModule as CoreCommonModule} from '@angular/common';
import {ReactiveFormsModule as CoreReactiveFormsModule} from '@angular/forms';
import {RouterModule as CoreRouterModule} from '@angular/router';
/* Vendor Dependencies */
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {MatIconModule} from '@angular/material/icon';
import {MatDialogModule} from '@angular/material/dialog';
import {MatCardModule} from '@angular/material/card';
import {MatRippleModule} from '@angular/material/core';
import {MatButtonModule} from '@angular/material/button';
import {MatMenuModule} from '@angular/material/menu';
import {BaseChartDirective as ChartJsBaseChartDirective} from 'ng2-charts';
/* Application Dependencies */
import {OrcFormModule} from '@client/modules/form/form.module';
import {OrcGraphicModule} from '@client/modules/graphic/graphic.module';
import {OrcNavModule} from '@client/modules/nav/nav.module';
import {OrcLocalModule} from '@client/modules/local/local.module';
import {OrcPublicModule} from '@client/modules/public/public.module';
import {OrcMintGeneralModule} from '@client/modules/mint/modules/mint-general/mint-general.module';
/* Application Dependencies */
import {pendingEventGuard} from '@client/modules/event/guards/pending-event.guard';
/* Local Dependencies */
import {MintSubsectionConfigComponent} from './components/mint-subsection-config/mint-subsection-config.component';
import {MintSubsectionConfigFormEnabledComponent} from './components/mint-subsection-config-form-enabled/mint-subsection-config-form-enabled.component';
import {MintSubsectionConfigFormEnabledDialogComponent} from './components/mint-subsection-config-form-enabled-dialog/mint-subsection-config-form-enabled-dialog.component';
import {MintSubsectionConfigFormQuoteTtlComponent} from './components/mint-subsection-config-form-quote-ttl/mint-subsection-config-form-quote-ttl.component';
import {MintSubsectionConfigFormBolt11Component} from './components/mint-subsection-config-form-bolt11/mint-subsection-config-form-bolt11.component';
import {MintSubsectionConfigFormBolt12Component} from './components/mint-subsection-config-form-bolt12/mint-subsection-config-form-bolt12.component';
import {MintSubsectionConfigFormOnchainComponent} from './components/mint-subsection-config-form-onchain/mint-subsection-config-form-onchain.component';
import {MintSubsectionConfigFormMinComponent} from './components/mint-subsection-config-form-min/mint-subsection-config-form-min.component';
import {MintSubsectionConfigFormMaxComponent} from './components/mint-subsection-config-form-max/mint-subsection-config-form-max.component';
import {MintSubsectionConfigChartQuoteTtlComponent} from './components/mint-subsection-config-chart-quote-ttl/mint-subsection-config-chart-quote-ttl.component';
import {MintSubsectionConfigChartMethodComponent} from './components/mint-subsection-config-chart-method/mint-subsection-config-chart-method.component';
import {MintSubsectionConfigNutComponent} from './components/mint-subsection-config-nut/mint-subsection-config-nut.component';
import {MintSubsectionConfigNutSupportedComponent} from './components/mint-subsection-config-nut-supported/mint-subsection-config-nut-supported.component';
import {MintSubsectionConfigNut15MethodComponent} from './components/mint-subsection-config-nut15-method/mint-subsection-config-nut15-method.component';
import {MintSubsectionConfigNut17CommandsComponent} from './components/mint-subsection-config-nut17-commands/mint-subsection-config-nut17-commands.component';
import {MintSubsectionConfigNut19Component} from './components/mint-subsection-config-nut19/mint-subsection-config-nut19.component';
import {MintSubsectionConfigFormQuoteTtlHintComponent} from './components/mint-subsection-config-form-quote-ttl-hint/mint-subsection-config-form-quote-ttl-hint.component';
import {MintSubsectionConfigStatsComponent} from './components/mint-subsection-config-stats/mint-subsection-config-stats.component';
import {MintSubsectionConfigStatComponent} from './components/mint-subsection-config-stat/mint-subsection-config-stat.component';
import {MintSubsectionConfigFormLimitHintComponent} from './components/mint-subsection-config-form-limit-hint/mint-subsection-config-form-limit-hint.component';
import {MintSubsectionConfigNut21Component} from './components/mint-subsection-config-nut21/mint-subsection-config-nut21.component';
import {MintSubsectionConfigNut22Component} from './components/mint-subsection-config-nut22/mint-subsection-config-nut22.component';
import {MintSubsectionConfigNut29Component} from './components/mint-subsection-config-nut29/mint-subsection-config-nut29.component';

@NgModule({
	declarations: [
		MintSubsectionConfigComponent,
		MintSubsectionConfigFormEnabledComponent,
		MintSubsectionConfigFormEnabledDialogComponent,
		MintSubsectionConfigFormQuoteTtlComponent,
		MintSubsectionConfigChartQuoteTtlComponent,
		MintSubsectionConfigFormBolt11Component,
		MintSubsectionConfigFormBolt12Component,
		MintSubsectionConfigFormOnchainComponent,
		MintSubsectionConfigFormMinComponent,
		MintSubsectionConfigFormMaxComponent,
		MintSubsectionConfigChartMethodComponent,
		MintSubsectionConfigNutComponent,
		MintSubsectionConfigNutSupportedComponent,
		MintSubsectionConfigNut15MethodComponent,
		MintSubsectionConfigNut17CommandsComponent,
		MintSubsectionConfigNut19Component,
		MintSubsectionConfigFormQuoteTtlHintComponent,
		MintSubsectionConfigStatsComponent,
		MintSubsectionConfigStatComponent,
		MintSubsectionConfigFormLimitHintComponent,
		MintSubsectionConfigNut21Component,
		MintSubsectionConfigNut22Component,
		MintSubsectionConfigNut29Component,
	],
	imports: [
		CoreRouterModule.forChild([
			{
				path: '',
				component: MintSubsectionConfigComponent,
				canDeactivate: [pendingEventGuard],
			},
		]),
		CoreCommonModule,
		CoreReactiveFormsModule,
		MatCardModule,
		MatFormFieldModule,
		MatInputModule,
		MatSelectModule,
		MatSlideToggleModule,
		MatDialogModule,
		MatIconModule,
		MatRippleModule,
		MatButtonModule,
		MatMenuModule,
		ChartJsBaseChartDirective,
		OrcFormModule,
		OrcGraphicModule,
		OrcNavModule,
		OrcLocalModule,
		OrcPublicModule,
		OrcMintGeneralModule,
	],
	exports: [],
})
export class OrcMintSubsectionConfigModule {}
