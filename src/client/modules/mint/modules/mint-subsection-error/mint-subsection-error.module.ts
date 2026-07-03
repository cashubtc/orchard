/* Core Dependencies */
import {NgModule} from '@angular/core';
import {CommonModule as CoreCommonModule} from '@angular/common';
import {RouterModule as CoreRouterModule} from '@angular/router';
import {ReactiveFormsModule as CoreReactiveFormsModule} from '@angular/forms';
/* Vendor Dependencies */
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatSelectModule} from '@angular/material/select';
/* Application Dependencies */
import {OrcErrorModule} from '@client/modules/error/error.module';
/* Local Dependencies */
import {MintSubsectionErrorComponent} from './components/mint-subsection-error/mint-subsection-error.component';

@NgModule({
	declarations: [MintSubsectionErrorComponent],
	imports: [
		CoreRouterModule.forChild([
			{
				path: '',
				component: MintSubsectionErrorComponent,
			},
		]),
		CoreCommonModule,
		CoreReactiveFormsModule,
		MatFormFieldModule,
		MatSelectModule,
		OrcErrorModule,
	],
	exports: [],
})
export class OrcMintSubsectionErrorModule {}
