/* Core Dependencies */
import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
/* Vendor Dependencies */
import {MatIconModule} from '@angular/material/icon';
import {MatDialogModule} from '@angular/material/dialog';
import {MatButtonModule} from '@angular/material/button';
import {MatSliderModule} from '@angular/material/slider';
/* Native Module Dependencies */
import {GraphicOrchardLogoComponent} from './components/graphic-orchard-logo/graphic-orchard-logo.component';
import {GraphicAssetComponent} from './components/graphic-asset/graphic-asset.component';
import {GraphicOracleComponent} from './components/graphic-oracle/graphic-oracle.component';
import {GraphicOracleIconComponent} from './components/graphic-oracle-icon/graphic-oracle-icon.component';
import {GraphicStatusComponent} from './components/graphic-status/graphic-status.component';
import {GraphicGroundskeeperComponent} from './components/graphic-groundskeeper/graphic-groundskeeper.component';
import {GraphicQrComponent} from './components/graphic-qr/graphic-qr.component';
import {GraphicQrDialogComponent} from './components/graphic-qr-dialog/graphic-qr-dialog.component';

@NgModule({
	declarations: [
		GraphicOrchardLogoComponent,
		GraphicAssetComponent,
		GraphicOracleComponent,
		GraphicOracleIconComponent,
		GraphicStatusComponent,
		GraphicGroundskeeperComponent,
		GraphicQrComponent,
		GraphicQrDialogComponent,
	],
	imports: [CommonModule, MatIconModule, MatDialogModule, MatButtonModule, MatSliderModule],
	exports: [
		GraphicOrchardLogoComponent,
		GraphicAssetComponent,
		GraphicOracleComponent,
		GraphicOracleIconComponent,
		GraphicStatusComponent,
		GraphicGroundskeeperComponent,
		GraphicQrComponent,
	],
})
export class OrcGraphicModule {}
