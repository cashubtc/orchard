/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
/* Application Dependencies */
import {toSats} from '@client/modules/local/helpers/unit.helpers';
import {MintReserves} from '@client/modules/mint/classes/mint-reserves.class';
import {
	getReserveSourcesLabel,
	getSolvencyRatio,
	getUnitLiabilities,
	roundSolvencyMultiple,
} from '@client/modules/mint/helpers/mint-solvency.helpers';
/* Native Dependencies */
import {SOLVENCY_VERDICTS} from '@client/modules/ecash/modules/ecash-general/constants/ecash-general.constants';
import {EcashSolvencyVerdict} from '@client/modules/ecash/modules/ecash-general/types/ecash-general.types';

@Component({
	selector: 'orc-ecash-general-solvency',
	standalone: false,
	templateUrl: './ecash-general-solvency.component.html',
	styleUrl: './ecash-general-solvency.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EcashGeneralSolvencyComponent {
	public readonly reserves = input.required<MintReserves>();
	public readonly unit = input.required<string>();
	public readonly wallet_amount = input<number>(0);

	public readonly liabilities = computed(() => getUnitLiabilities(this.reserves(), this.unit()));
	public readonly liabilities_sats = computed(() => toSats(this.unit(), this.liabilities()) ?? 0);
	public readonly reserves_label = computed(() => getReserveSourcesLabel(this.reserves().selected_sources));

	/** How many times reserves cover the unit's liabilities, rounded for display */
	public readonly coverage = computed(() => {
		const multiple = this.multiple();
		return multiple === null ? null : roundSolvencyMultiple(multiple);
	});

	/** Whether reserves cover every liability, fall short, or can't be read */
	public readonly verdict = computed<EcashSolvencyVerdict>(() => {
		if (this.reserves().reserves === null) return 'unknown';
		const multiple = this.multiple();
		return multiple === null || multiple >= 1 ? 'backed' : 'short';
	});

	public readonly verdict_view = computed(() => SOLVENCY_VERDICTS[this.verdict()]);

	private readonly multiple = computed(() => getSolvencyRatio(this.reserves(), this.unit()));
}
