/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input, signal} from '@angular/core';
/* Application Dependencies */
import {BitcoinOraclePrice} from '@client/modules/bitcoin/classes/bitcoin-oracle-price.class';
import {oracleConvertToUSDCents} from '@client/modules/bitcoin/helpers/oracle.helpers';
import {compareUnits} from '@client/modules/local/helpers/unit.helpers';
/* Native Dependencies */
import {EcashBalance} from '@client/modules/ecash/classes/ecash-balance.class';
import {EcashMint} from '@client/modules/ecash/classes/ecash-mint.class';
import {EcashUnitChip} from '@client/modules/ecash/modules/ecash-general/types/ecash-general.types';

@Component({
	selector: 'orc-ecash-general-balance',
	standalone: false,
	templateUrl: './ecash-general-balance.component.html',
	styleUrl: './ecash-general-balance.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EcashGeneralBalanceComponent {
	public readonly balances = input.required<EcashBalance[]>();
	public readonly mints = input<EcashMint[]>([]);
	public readonly loading = input<boolean>(false);
	public readonly bitcoin_oracle_enabled = input<boolean>(false);
	public readonly bitcoin_oracle_price = input<BitcoinOraclePrice | null>(null);

	/** Every unit the wallet's mints offer, with its balance summed across mints; sat alone without mints */
	public readonly chips = computed<Required<EcashUnitChip>[]>(() => {
		const totals = new Map<string, number>();
		for (const mint of this.mints()) {
			for (const unit of mint.units) totals.set(unit.toLowerCase(), 0);
		}
		for (const {unit, balance} of this.balances()) {
			const key = unit.toLowerCase();
			totals.set(key, (totals.get(key) ?? 0) + balance);
		}
		if (totals.size === 0) totals.set('sat', 0);
		return [...totals].map(([unit, amount]) => ({unit, amount})).sort((a, b) => compareUnits(a.unit, b.unit));
	});

	/** The picked unit's balance, its USD value while held, and where it's held */
	public readonly selection = computed(() => {
		const chips = this.chips();
		const chip = chips.find((item) => item.unit === this.picked_unit()) ?? chips[0];
		const oracle_price = this.bitcoin_oracle_enabled() ? (this.bitcoin_oracle_price()?.price ?? null) : null;
		const holdings = this.balances().filter((balance) => balance.unit.toLowerCase() === chip.unit && balance.balance > 0);
		return {
			unit: chip.unit,
			amount: chip.amount,
			amount_oracle: holdings.length > 0 ? oracleConvertToUSDCents(chip.amount, oracle_price, chip.unit) : null,
			caption: this.getHoldingsCaption(holdings.map((holding) => holding.mint_id)),
		};
	});

	private readonly picked_unit = signal<string | null>(null);

	/** Shows the picked unit's balance */
	public onSelect(unit: string): void {
		this.picked_unit.set(unit);
	}

	/** Names the one mint holding a balance, counts several, or says none does */
	private getHoldingsCaption(mint_ids: string[]): string {
		if (mint_ids.length === 0) return 'No balance on any mint';
		if (mint_ids.length > 1) return `Across ${mint_ids.length} mints`;
		return this.mints().find((mint) => mint.id === mint_ids[0])?.display_name ?? 'Across 1 mint';
	}
}
