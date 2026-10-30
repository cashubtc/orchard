/* Core Dependencies */
import {NgModule} from '@angular/core';
import {CommonModule as CoreCommonModule} from '@angular/common';
/* Vendor Dependencies */
import {MatIconModule} from '@angular/material/icon';
import {MatRippleModule} from '@angular/material/core';
/* Native Dependencies */
import {ButtonCopyComponent} from './components/button-copy/button-copy.component';

@NgModule({
	imports: [CoreCommonModule, MatIconModule, MatRippleModule],
	declarations: [ButtonCopyComponent],
	exports: [ButtonCopyComponent],
})
export class OrcButtonModule {}
