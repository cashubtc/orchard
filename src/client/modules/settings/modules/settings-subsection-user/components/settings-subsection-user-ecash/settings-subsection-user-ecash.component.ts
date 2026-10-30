/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input, output} from '@angular/core';
/* Application Dependencies */
import {DeviceType} from '@client/modules/layout/types/device.types';
import {EcashSeed} from '@client/modules/ecash/classes/ecash-seed.class';
import {EcashMint} from '@client/modules/ecash/classes/ecash-mint.class';
import {getMintRestoreUrls} from '@client/modules/ecash/modules/ecash-general/helpers/ecash-general.helpers';

@Component({
	selector: 'orc-settings-subsection-user-ecash',
	standalone: false,
	templateUrl: './settings-subsection-user-ecash.component.html',
	styleUrl: './settings-subsection-user-ecash.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsSubsectionUserEcashComponent {
	public readonly seed = input.required<EcashSeed | null>();
	public readonly mints = input<EcashMint[]>([]);
	public readonly device_type = input<DeviceType>('desktop');

	public readonly backup = output<void>();

	public readonly backed_up_at = computed(() => this.seed()?.backed_up_at ?? null);
	/** The mint URLs a restore needs beside the words */
	public readonly restore_urls = computed(() => getMintRestoreUrls(this.mints()));
	/** On a phone the action gets its own row, so the title and status never wrap */
	public readonly mobile = computed(() => this.device_type() === 'mobile');
}
