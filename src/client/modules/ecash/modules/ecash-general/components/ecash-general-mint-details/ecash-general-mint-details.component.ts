/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
/* Application Dependencies */
import {MintInfo} from '@client/modules/mint/classes/mint-info.class';
import {DeviceType} from '@client/modules/layout/types/device.types';
import {MINT_CONTACT_METHODS} from '@client/modules/mint/constants/mint.constants';
import {getMintUri} from '@client/modules/mint/helpers/mint-uri.helpers';
/* Native Dependencies */
import {
	buildMintFeatures,
	buildMintLimits,
	getTimeOffsetLabel,
} from '@client/modules/ecash/modules/ecash-general/helpers/ecash-general.helpers';

@Component({
	selector: 'orc-ecash-general-mint-details',
	standalone: false,
	templateUrl: './ecash-general-mint-details.component.html',
	styleUrl: './ecash-general-mint-details.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EcashGeneralMintDetailsComponent {
	public readonly info = input.required<MintInfo>();
	public readonly time_offset = input<number | null>(null);
	public readonly device_type = input<DeviceType>('desktop');

	public readonly mobile = computed(() => this.device_type() === 'mobile');
	public readonly connections = computed(() => (this.info().urls ?? []).map((url) => getMintUri(url)));
	public readonly limit_groups = computed(() => buildMintLimits(this.info()));
	public readonly features = computed(() => buildMintFeatures(this.info().nuts));
	/** Rows in the two-column features grid, so it fills down the left column before the right */
	public readonly feature_rows = computed(() => Math.ceil(this.features().length / 2));
	public readonly time_label = computed(() => getTimeOffsetLabel(this.time_offset()));

	/** The confirmations onchain deposits need before they mint, when the mint sets any */
	public readonly confirmations = computed(
		() => this.info().nuts.nut4.methods.find((method) => method.options?.confirmations)?.options?.confirmations ?? null,
	);

	/** The mint's contacts with each method's icon; unknown methods show a link */
	public readonly contacts = computed(() =>
		(this.info().contact ?? []).map((contact) => {
			const method = MINT_CONTACT_METHODS.find((option) => option.method === contact.method);
			return {info: contact.info, icon: method?.icon || 'link', svg: method?.svg ?? ''};
		}),
	);
}
