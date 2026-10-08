/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input, output} from '@angular/core';
/* Application Dependencies */
import {DeviceType} from '@client/modules/layout/types/device.types';

@Component({
	selector: 'orc-ecash-general-actions',
	standalone: false,
	templateUrl: './ecash-general-actions.component.html',
	styleUrl: './ecash-general-actions.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EcashGeneralActionsComponent {
	public readonly can_issue = input<boolean>(false);
	public readonly issue_blocked = input<string | null>(null);
	public readonly device_type = input.required<DeviceType>();

	public readonly issue = output<void>();

	/** Phones show the actions as a row of compact tiles */
	public readonly tiles = computed(() => this.device_type() === 'mobile');
}
