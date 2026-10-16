/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input, model} from '@angular/core';
/* Application Dependencies */
import {MintInfo} from '@client/modules/mint/classes/mint-info.class';
import {DeviceType} from '@client/modules/layout/types/device.types';
import {getMintUri} from '@client/modules/mint/helpers/mint-uri.helpers';
import {getMintMethods} from '@client/modules/mint/helpers/mint-method.helpers';
import {isMintAuthOffered} from '@client/modules/mint/helpers/mint-nut.helpers';
/* Native Dependencies */
import {buildUnitChips, getMintOnlineText} from '@client/modules/ecash/modules/ecash-general/helpers/ecash-general.helpers';

@Component({
	selector: 'orc-ecash-general-mint-info',
	standalone: false,
	templateUrl: './ecash-general-mint-info.component.html',
	styleUrl: './ecash-general-mint-info.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EcashGeneralMintInfoComponent {
	public readonly info = input.required<MintInfo>();
	public readonly url = input.required<string>();
	public readonly latency_ms = input<number | null>(null);
	public readonly time_offset = input<number | null>(null);
	public readonly compact = input<boolean>(false);
	public readonly device_type = input<DeviceType>('desktop');
	public readonly expanded = model<boolean>(false);

	public readonly mobile = computed(() => this.device_type() === 'mobile');
	public readonly uri = computed(() => getMintUri(this.url()));
	public readonly name = computed(() => this.info().name ?? this.uri().label);

	/** Where the mint is and what it runs: its host, or "Tor address", then its version */
	public readonly subtitle = computed(() => {
		const place = this.uri().type === 'tor' ? 'Tor address' : this.uri().label;
		const version = this.info().version?.replace('/', ' ');
		return version ? `${place} · ${version}` : place;
	});

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
