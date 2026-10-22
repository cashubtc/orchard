/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';
import {Router} from '@angular/router';
/* Application Dependencies */
import {GraphicStatusState} from '@client/modules/graphic/types/graphic-status.types';
/* Native Dependencies */
import {MintInfo} from '@client/modules/mint/classes/mint-info.class';
import {MintNut} from '@client/modules/mint/types/nut.types';
import {getMintMethods} from '@client/modules/mint/helpers/mint-method.helpers';
import {isNutOffered} from '@client/modules/mint/helpers/mint-nut.helpers';
/* Shared Dependencies */
import {OrchardNuts} from '@shared/generated.types';

@Component({
	selector: 'orc-mint-general-config',
	standalone: false,
	templateUrl: './mint-general-config.component.html',
	styleUrl: './mint-general-config.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintGeneralConfigComponent {
	private readonly router = inject(Router);

	public info = input.required<MintInfo | null>();

	/** Simplified list of nut numbers and their support status. */
	public nuts = computed(() => {
		const nuts = this.info()?.nuts;
		if (!nuts) return [];
		return Object.entries(nuts)
			.filter(([key]) => key.startsWith('nut'))
			.map(([key, value]) => {
				const number = parseInt(key.replace('nut', ''), 10);
				return {
					number,
					status: this.getNutStatus(number, value as OrchardNuts[MintNut]),
				};
			});
	});

	/** Deduped payment methods supported across minting (NUT4) and melting (NUT5). */
	public supported_methods = computed<string[]>(() => {
		const nuts = this.info()?.nuts;
		return nuts ? getMintMethods(nuts) : [];
	});

	/** Navigates to the mint config page and scrolls to the selected nut's section. */
	public onNutClick(nut_number: number): void {
		this.router.navigate(['mint', 'config'], {
			state: {scroll_to: `nav${nut_number}`},
		});
	}

	/** Derives a status string from a nut number and its value. */
	private getNutStatus(number: number, nut: OrchardNuts[MintNut]): GraphicStatusState {
		const offered = isNutOffered(nut);
		if (number === 4 || number === 5) return offered ? 'active' : 'inactive';
		return offered ? 'enabled' : 'disabled';
	}
}
