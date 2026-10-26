/* Core Dependencies */
import {ChangeDetectionStrategy, Component, inject, input, linkedSignal} from '@angular/core';
import {outputFromObservable, toObservable} from '@angular/core/rxjs-interop';

/* Vendor Dependencies */
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatIconModule} from '@angular/material/icon';

/* Application Dependencies */
import {SettingDeviceService} from '@client/modules/settings/services/setting-device/setting-device.service';

/* Native Dependencies */
import {FEDERATION_BACKUP_ACKNOWLEDGEMENT, FEDERATION_BACKUP_CONTENTS} from '@client/modules/federation/constants/federation.constants';

@Component({
	selector: 'orc-federation-backup',
	imports: [MatCheckboxModule, MatIconModule],
	templateUrl: './federation-backup.component.html',
	styleUrl: './federation-backup.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FederationBackupComponent {
	private readonly setting_device_service = inject(SettingDeviceService);

	public readonly contents = FEDERATION_BACKUP_CONTENTS;
	public readonly acknowledgement = FEDERATION_BACKUP_ACKNOWLEDGEMENT;

	public readonly federation_id = input<string | null>(null);
	public readonly warning = input<string | null>(null);

	public readonly confirmed = linkedSignal<boolean>(() => {
		const federation_id = this.federation_id();
		if (!federation_id) return false;
		return this.setting_device_service.getFederationBackupAcknowledgements(federation_id).includes(this.acknowledgement);
	});

	public readonly complete = outputFromObservable(toObservable(this.confirmed));

	/* *******************************************************
        Actions Up
    ******************************************************** */

	/** Record the operator's own statement without claiming Orchard performed a backup. */
	public confirm(checked: boolean): void {
		this.confirmed.set(checked);
		const federation_id = this.federation_id();
		if (federation_id)
			this.setting_device_service.setFederationBackupAcknowledgements(federation_id, checked ? [this.acknowledgement] : []);
	}
}
