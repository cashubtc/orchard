/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
/* Application Dependencies */
import {BitcoinOraclePrice} from '@client/modules/bitcoin/classes/bitcoin-oracle-price.class';
import {oracleConvertToUSDCents} from '@client/modules/bitcoin/helpers/oracle.helpers';
import {getUnitMeta} from '@client/modules/local/helpers/unit.helpers';
/* Native Dependencies */
import {EcashBalance} from '@client/modules/ecash/classes/ecash-balance.class';

type EcashBalanceRow = {
	unit: string;
	balance: number;
	balance_oracle: number | null;
	mints: number;
};

@Component({
	selector: 'orc-ecash-general-balance',
	standalone: false,
	templateUrl: './ecash-general-balance.component.html',
	styleUrl: './ecash-general-balance.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EcashGeneralBalanceComponent {
	public readonly balances = input.required<EcashBalance[]>();
	public readonly loading = input<boolean>(false);
	public readonly bitcoin_oracle_enabled = input<boolean>(false);
	public readonly bitcoin_oracle_price = input<BitcoinOraclePrice | null>(null);

	/** One row per unit the wallet holds, summed across mints; bitcoin units first */
	public readonly rows = computed<EcashBalanceRow[]>(() => {
		const oracle_price = this.bitcoin_oracle_enabled() ? (this.bitcoin_oracle_price()?.price ?? null) : null;
		const rows_by_unit = new Map<string, EcashBalanceRow>();
		for (const {unit, balance} of this.balances()) {
			if (balance <= 0) continue;
			const key = unit.toLowerCase();
			const row = rows_by_unit.get(key) ?? {unit: key, balance: 0, balance_oracle: null, mints: 0};
			row.balance += balance;
			row.mints += 1;
			rows_by_unit.set(key, row);
		}
		return [...rows_by_unit.values()]
			.map((row) => ({...row, balance_oracle: oracleConvertToUSDCents(row.balance, oracle_price, row.unit)}))
			.sort((a, b) => this.unitRank(a.unit) - this.unitRank(b.unit) || a.unit.localeCompare(b.unit));
	});

	/** Bitcoin units sort before fiat, fiat before custom */
	private unitRank(unit: string): number {
		return ['btc', 'fiat', 'custom'].indexOf(getUnitMeta(unit).family);
	}
}
