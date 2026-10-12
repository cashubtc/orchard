/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
/* Application Dependencies */
import {getUnitMeta} from '@client/modules/local/helpers/unit.helpers';
import {MintReserves} from '@client/modules/mint/classes/mint-reserves.class';
/* Native Dependencies */
import {EcashMint} from '@client/modules/ecash/classes/ecash-mint.class';
import {EcashBalance} from '@client/modules/ecash/classes/ecash-balance.class';
import {EcashMintStatusPill} from '@client/modules/ecash/modules/ecash-general/types/ecash-general.types';
import {buildUnitChips} from '@client/modules/ecash/modules/ecash-general/helpers/ecash-general.helpers';

@Component({
	selector: 'orc-ecash-general-mint',
	standalone: false,
	templateUrl: './ecash-general-mint.component.html',
	styleUrl: './ecash-general-mint.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EcashGeneralMintComponent {
	public readonly mint = input.required<EcashMint>();
	public readonly balances = input<EcashBalance[]>([]);
	public readonly status = input.required<EcashMintStatusPill>();
	public readonly reserves = input<MintReserves | null>(null);

	public readonly chips = computed(() => buildUnitChips(this.mint().units, this.balances()));

	/** The balance sheet in the mint's first bitcoin unit; reserves back nothing else */
	public readonly solvency = computed(() => {
		const reserves = this.reserves();
		if (!reserves) return null;
		const chip = this.chips().find((item) => getUnitMeta(item.unit).family === 'btc');
		return chip ? {reserves, unit: chip.unit, wallet_amount: chip.amount} : null;
	});
}
