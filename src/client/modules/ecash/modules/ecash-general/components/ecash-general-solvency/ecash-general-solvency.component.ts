/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input, signal} from '@angular/core';
/* Application Dependencies */
import {toSats} from '@client/modules/local/helpers/unit.helpers';
import {MintReserves} from '@client/modules/mint/classes/mint-reserves.class';
import {
	getReserveSourcesLabel,
	getSolvencyMultiple,
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
	public readonly issuing = input<number | null>(null);
	public readonly collapsible = input<boolean>(false);

	public readonly expanded = signal<boolean>(false);

	public readonly liabilities = computed(() => this.liabilities_before() + (this.issuing() ?? 0));
	public readonly liabilities_sats = computed(() => toSats(this.unit(), this.liabilities()) ?? 0);
	public readonly reserves_label = computed(() => getReserveSourcesLabel(this.reserves().selected_sources));
	public readonly impact = computed(() => this.issuing() !== null);
	public readonly entered = computed(() => (this.issuing() ?? 0) > 0);
	public readonly open = computed(() => !this.collapsible() || this.expanded());
	public readonly rendered = computed(() => !this.collapsible() || this.opened());

	/** How many times reserves cover the unit's liabilities, rounded for display */
	public readonly coverage = computed(() => {
		const multiple = this.multiple();
		return multiple === null ? null : roundSolvencyMultiple(multiple);
	});

	/** Coverage before the issue, rounded for display */
	public readonly coverage_before = computed(() => {
		const multiple = this.multiple_before();
		return multiple === null ? null : roundSolvencyMultiple(multiple);
	});

	/** Whether reserves cover every liability, fall short, aren't selected, or can't be read */
	public readonly verdict = computed<EcashSolvencyVerdict>(() => {
		if (this.reserves().selected_sources.length === 0) return 'none';
		if (this.reserves().reserves === null) return 'unknown';
		const multiple = this.multiple();
		return multiple === null || multiple >= 1 ? 'backed' : 'short';
	});

	public readonly verdict_icon = computed(() => SOLVENCY_VERDICTS[this.verdict()].icon);

	/** The verdict's label; an issue is only blamed for a shortfall it causes */
	public readonly verdict_label = computed(() => {
		const view = SOLVENCY_VERDICTS[this.verdict()];
		if (!this.entered()) return view.label;
		if (view.short_before_label && (this.multiple_before() ?? 1) < 1) return view.short_before_label;
		return view.impact_label ?? view.label;
	});

	private readonly opened = signal<boolean>(false);

	private readonly liabilities_before = computed(() => getUnitLiabilities(this.reserves(), this.unit()));
	private readonly multiple = computed(() => getSolvencyMultiple(this.reserves().reserves, this.liabilities(), this.unit()));
	private readonly multiple_before = computed(() =>
		getSolvencyMultiple(this.reserves().reserves, this.liabilities_before(), this.unit()),
	);

	/** Shows or hides the stacks of a collapsible balance sheet, which are only built once first shown */
	public onToggle(): void {
		this.expanded.update((expanded) => !expanded);
		this.opened.set(true);
	}
}
