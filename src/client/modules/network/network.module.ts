/* Core Dependencies */
import {NgModule} from '@angular/core';
import {CommonModule as CoreCommonModule} from '@angular/common';
/* Vendor Dependencies */
import {MatDialogModule} from '@angular/material/dialog';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatSliderModule} from '@angular/material/slider';
import {MatIconModule} from '@angular/material/icon';
import {MatButtonModule} from '@angular/material/button';
/* Application Dependencies */
import {OrcButtonModule} from '@client/modules/button/button.module';
import {OrcGraphicModule} from '@client/modules/graphic/graphic.module';
/* Native Dependencies */
import {NetworkConnectionComponent} from './components/network-connection/network-connection.component';
import {NetworkConnectionStatusComponent} from './components/network-connection-status/network-connection-status.component';

@NgModule({
	imports: [
		CoreCommonModule,
		MatDialogModule,
		MatSlideToggleModule,
		MatFormFieldModule,
		MatSliderModule,
		MatIconModule,
		MatButtonModule,
		OrcButtonModule,
		OrcGraphicModule,
	],
	declarations: [NetworkConnectionComponent, NetworkConnectionStatusComponent],
	exports: [NetworkConnectionStatusComponent],
})
export class OrcNetworkModule {}
