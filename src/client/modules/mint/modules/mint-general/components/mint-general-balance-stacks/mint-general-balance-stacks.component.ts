/* Core Dependencies */
import {ChangeDetectionStrategy, Component, input, computed} from '@angular/core';
/* Application Dependencies */
import {getUnitMeta} from '@client/modules/local/helpers/unit.helpers';

@Component({
	selector: 'orc-mint-general-balance-stacks',
	standalone: false,
	templateUrl: './mint-general-balance-stacks.component.html',
	styleUrl: './mint-general-balance-stacks.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintGeneralBalanceStacksComponent {
	public assets = input.required<number>();
	public liabilities = input.required<number>();
	public unit = input.required<string>();
	public reserve = input.required<number | null>();

	public unit_class = computed(() => {
		return `coin-${getUnitMeta(this.unit()).asset}`;
	});
	public asset_rows = computed(() => this.buildRows(this.calcStackSize(this.assets(), this.liabilities())));
	public liability_rows = computed(() => this.buildRows(this.calcStackSize(this.liabilities(), this.assets())));

	/** Calculates a stack size (1–18) based on the ratio of value to total */
	private calcStackSize(value: number, counterpart: number): number {
		if (!value) return 1;
		if (value > counterpart) return 18;
		const ratio = value / (value + counterpart);
		const stack = ratio * 18;
		return Math.max(1, Math.min(18, Math.ceil(stack)));
	}

	/** Selects pyramid shape based on coin count: 1-3 → 1 tier, 4-9 → 2 tiers, 10-18 → 3 tiers */
	private buildRows(count: number): number[][] {
		const tier_groups = count <= 3 ? [1] : count <= 9 ? [2, 1] : [3, 2, 1];
		let remaining = count;
		return tier_groups
			.map((num_groups) => {
				const tier_coins = Math.min(num_groups * 3, remaining);
				remaining -= tier_coins;
				const base = Math.floor(tier_coins / num_groups);
				const extra = tier_coins % num_groups;
				const groups: number[] = [];
				for (let i = 0; i < num_groups; i++) {
					const coins = base + (i >= num_groups - extra ? 1 : 0);
					if (coins > 0) groups.push(coins);
				}
				return groups;
			})
			.reverse();
	}
}
