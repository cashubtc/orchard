/* Core Dependencies */
import {ChangeDetectionStrategy, Component, input, output, signal} from '@angular/core';

/* Vendor Dependencies */
import {MatCheckboxModule} from '@angular/material/checkbox';

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
	public readonly items = FEDERATION_BACKUP_ITEMS;

	public readonly warning = input<string | null>(null);
	public readonly complete = output<boolean>();

	public readonly checked = signal<Record<number, boolean>>({});

	/** Track the local checklist without claiming Orchard performed a backup. */
	public check(index: number, checked: boolean): void {
		this.checked.update((values) => ({...values, [index]: checked}));
		this.complete.emit(this.items.every((_, item_index) => this.checked()[item_index]));
	}
}
