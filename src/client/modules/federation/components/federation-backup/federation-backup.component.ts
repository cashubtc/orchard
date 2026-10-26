/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, inject, input, linkedSignal} from '@angular/core';
import {outputFromObservable, toObservable} from '@angular/core/rxjs-interop';

/* Vendor Dependencies */
import {MatCheckboxModule} from '@angular/material/checkbox';

/* Application Dependencies */
import {SettingDeviceService} from '@client/modules/settings/services/setting-device/setting-device.service';

/* Native Dependencies */
import {FEDERATION_BACKUP_ITEMS} from '@client/modules/federation/constants/federation.constants';

@Component({
	selector: 'orc-federation-backup',
	imports: [MatCheckboxModule],
	templateUrl: './federation-backup.component.html',
	styleUrl: './federation-backup.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FederationBackupComponent {
	private readonly setting_device_service = inject(SettingDeviceService);

	public readonly items = FEDERATION_BACKUP_ITEMS;

	public readonly federation_id = input<string | null>(null);
	public readonly warning = input<string | null>(null);

	public readonly acknowledged = linkedSignal<string[]>(() => {
		const federation_id = this.federation_id();
		return federation_id ? this.setting_device_service.getFederationBackupAcknowledgements(federation_id) : [];
	});

	public readonly is_complete = computed(() => this.items.every((item) => this.acknowledged().includes(item)));

	public readonly complete = outputFromObservable(toObservable(this.is_complete));

	/* *******************************************************
        Actions Up
    ******************************************************** */

	/** Track the local checklist without claiming Orchard performed a backup. */
	public check(item: string, checked: boolean): void {
		const acknowledged = this.items.filter((entry) => (entry === item ? checked : this.acknowledged().includes(entry)));
		this.acknowledged.set(acknowledged);
		const federation_id = this.federation_id();
		if (federation_id) this.setting_device_service.setFederationBackupAcknowledgements(federation_id, acknowledged);
	}
}
