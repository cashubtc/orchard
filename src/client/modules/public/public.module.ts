/* Core Dependencies */
import {NgModule} from '@angular/core';
import {CommonModule as CoreCommonModule} from '@angular/common';
/* Vendor Dependencies */
import {MatDialogModule} from '@angular/material/dialog';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';
import {MatCardModule} from '@angular/material/card';
/* Native Module Dependencies */
import {PublicExitWarningComponent} from './components/public-exit-warning/public-exit-warning.component';
import {PublicDocsLinkCardComponent} from './components/public-docs-link-card/public-docs-link-card.component';

@NgModule({
	declarations: [PublicExitWarningComponent, PublicDocsLinkCardComponent],
	imports: [CoreCommonModule, MatDialogModule, MatButtonModule, MatIconModule, MatCardModule],
	exports: [PublicDocsLinkCardComponent],
})
export class OrcPublicModule {}
