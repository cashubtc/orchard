/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';

@Component({
	selector: 'orc-ecash-general-restore-urls',
	standalone: false,
	templateUrl: './ecash-general-restore-urls.component.html',
	styleUrl: './ecash-general-restore-urls.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EcashGeneralRestoreUrlsComponent {
	/** One URL per wallet mint, for a restoring wallet to add */
	public readonly urls = input.required<string[]>();

	public readonly text = computed(() => this.urls().join('\n'));
}
