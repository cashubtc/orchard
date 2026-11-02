/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input, model} from '@angular/core';
/* Application Dependencies */
import {MintInfo} from '@client/modules/mint/classes/mint-info.class';
import {DeviceType} from '@client/modules/layout/types/device.types';
import {getMintUri} from '@client/modules/mint/helpers/mint-uri.helpers';
import {getMintMethods} from '@client/modules/mint/helpers/mint-method.helpers';
import {isMintAuthOffered} from '@client/modules/mint/helpers/mint-nut.helpers';
/* Native Dependencies */
import {
	buildUnitChips,
	getMintOnlineText,
	getMintSubtitle,
} from '@client/modules/ecash/modules/ecash-general/helpers/ecash-general.helpers';

@Component({
	selector: 'orc-ecash-general-mint-info',
	standalone: false,
	templateUrl: './ecash-general-mint-info.component.html',
	styleUrl: './ecash-general-mint-info.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EcashGeneralMintInfoComponent {
	public readonly info = input.required<MintInfo>();
	/** The mint's address; null when it has no public URL */
	public readonly url = input<string | null>(null);
	public readonly latency_ms = input<number | null>(null);
	public readonly time_offset = input<number | null>(null);
	/** When the mint joined the wallet, for one already in it */
	public readonly added_at = input<number | null>(null);
	public readonly compact = input<boolean>(false);
	/** Whether the card names the mint itself, or its host already does */
	public readonly header = input<boolean>(true);
	public readonly device_type = input<DeviceType>('desktop');
	public readonly expanded = model<boolean>(false);

	public readonly mobile = computed(() => this.device_type() === 'mobile');
	public readonly uri = computed(() => {
		const url = this.url();
		return url ? getMintUri(url) : null;
	});
	public readonly name = computed(() => this.info().name ?? this.uri()?.label ?? '');
	public readonly subtitle = computed(() => getMintSubtitle(this.url(), this.info().version));

	public readonly status_text = computed(() => getMintOnlineText(this.latency_ms()));

	public readonly sign_in_required = computed(() => isMintAuthOffered(this.info().nuts));
	public readonly unit_chips = computed(() =>
		buildUnitChips(
			this.info().nuts.nut4.methods.map((method) => method.unit),
			[],
		),
	);

	public readonly methods = computed(() => getMintMethods(this.info().nuts));

	/* *******************************************************
		Actions Up
	******************************************************** */

	/** Shows or hides everything beyond the summary */
	public onToggle(): void {
		this.expanded.update((expanded) => !expanded);
	}
}
