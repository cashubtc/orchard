/* Core Dependencies */
import {NgModule} from '@angular/core';
import {RouterModule as CoreRouterModule} from '@angular/router';
/* Vendor Dependencies */
import {MatIconModule} from '@angular/material/icon';
import {MatCardModule} from '@angular/material/card';
import {MatButtonModule} from '@angular/material/button';
/* Application Dependencies */
import {OrcSystemModule} from '@client/modules/system/system.module';
/* Local Dependencies */
import {IndexSubsectionSystemComponent} from './components/index-subsection-system/index-subsection-system.component';
import {IndexSystemInfoComponent} from './components/index-system-info/index-system-info.component';

@NgModule({
	declarations: [IndexSubsectionSystemComponent, IndexSystemInfoComponent],
	imports: [
		CoreRouterModule.forChild([
			{
				path: '',
				component: IndexSubsectionSystemComponent,
			},
		]),
		MatIconModule,
		MatCardModule,
		MatButtonModule,
		OrcSystemModule,
	],
	exports: [],
})
export class OrcIndexSubsectionSystemModule {}
