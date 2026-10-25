/* Core Dependencies */
import {ChangeDetectionStrategy, Component, inject} from '@angular/core';

/* Vendor Dependencies */
import {MAT_DIALOG_DATA, MatDialogModule} from '@angular/material/dialog';
import {MatButtonModule} from '@angular/material/button';
import {MatIconModule} from '@angular/material/icon';

/* Native Dependencies */
import type {FederationSetupConfirm} from '@client/modules/federation/types/federation-setup.types';

@Component({
	selector: 'orc-federation-setup-confirm-dialog',
	imports: [MatDialogModule, MatButtonModule, MatIconModule],
	templateUrl: './federation-setup-confirm-dialog.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FederationSetupConfirmDialogComponent {
	public readonly data = inject<FederationSetupConfirm>(MAT_DIALOG_DATA);
}
