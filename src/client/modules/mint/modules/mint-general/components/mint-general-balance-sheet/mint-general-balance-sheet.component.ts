/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input, output, signal} from '@angular/core';
/* Application Dependencies */
import {OrchardError} from '@client/modules/error/types/error.types';
import {DeviceType} from '@client/modules/layout/types/device.types';
import {BitcoinOraclePrice} from '@client/modules/bitcoin/classes/bitcoin-oracle-price.class';
import {getUnitMeta} from '@client/modules/local/helpers/unit.helpers';
/* Native Module Dependencies */
import {MintBalance} from '@client/modules/mint/classes/mint-balance.class';
import {MintKeyset} from '@client/modules/mint/classes/mint-keyset.class';
import {MintReserves} from '@client/modules/mint/classes/mint-reserves.class';
import {getReserveSourcesLabel} from '@client/modules/mint/helpers/mint-solvency.helpers';
/* Local Dependencies */
import {MintGeneralBalanceRow} from './mint-general-balance-row.class';

@Component({
	selector: 'orc-mint-general-balance-sheet',
	standalone: false,
	templateUrl: './mint-general-balance-sheet.component.html',
	styleUrl: './mint-general-balance-sheet.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintGeneralBalanceSheetComponent {
	public navigate = output<void>();

	public balances = input.required<MintBalance[]>();
	public keysets = input.required<MintKeyset[]>();
	public reserves = input.required<MintReserves | null>();
	public reserves_errors = input<OrchardError[]>([]);
	public reserves_loading = input.required<boolean>();
	public bitcoin_oracle_enabled = input.required<boolean>();
	public bitcoin_oracle_price = input.required<BitcoinOraclePrice | null>();
	public loading = input.required<boolean>();
	public device_type = input.required<DeviceType>();

	public expanded = signal<Record<string, boolean>>({});

	public readonly rows = computed<MintGeneralBalanceRow[]>(() => {
		if (this.loading()) return [];
		return this.computeRows();
	});

	/** Names the reserves the operator counts, for the assets caption */
	public readonly reserves_label = computed(() => getReserveSourcesLabel(this.reserves()?.selected_sources ?? []));

	/** Lightning custody while only channels back the mint, hot otherwise */
	public readonly reserves_custody = computed(() => ((this.reserves()?.channels_only ?? true) ? 'lightning' : 'hot'));

	/** Why reserves may be missing: the query failed, or selected sources could not be read */
	public readonly reserves_failures = computed<OrchardError[]>(() =>
		this.reserves_errors().length > 0 ? this.reserves_errors() : (this.reserves()?.failures ?? []),
	);

	/** The operator's reserves back bitcoin-denominated liabilities only */
	private getAssetBalances(unit: string): number | null {
		if (getUnitMeta(unit).family !== 'btc') return null;
		return this.reserves()?.reserves ?? null;
	}

	private computeRows(): MintGeneralBalanceRow[] {
		const rows_by_unit: Record<string, MintGeneralBalanceRow> = {};
		const keysets = this.keysets();
		const balances = this.balances();
		if (!keysets) return [];
		keysets
			.map((keyset) => {
				const liability_balance = balances.find((balance) => balance.keyset === keyset.id) ?? {
					keyset: keyset.id,
					balance: 0,
					balance_oracle: 0,
				};
				const asset_balance = this.getAssetBalances(keyset.unit);
				const oracle_price = this.bitcoin_oracle_price()?.price ?? null;
				return new MintGeneralBalanceRow(liability_balance, asset_balance, keyset, oracle_price);
			})
			.filter((row) => row !== null)
			.sort((a, b) => b.derivation_path_index - a.derivation_path_index)
			.forEach((row) => {
				const unit = row.unit_mint.toLowerCase();
				if (!rows_by_unit[unit]) {
					rows_by_unit[unit] = row;
					return;
				}
				rows_by_unit[unit].liabilities += row.liabilities;
				if (row.liabilities_oracle !== null)
					rows_by_unit[unit].liabilities_oracle = (rows_by_unit[unit].liabilities_oracle ?? 0) + row.liabilities_oracle;
				if (row.fees !== null) rows_by_unit[unit].fees = (rows_by_unit[unit].fees ?? 0) + row.fees;
				if (row.fees_oracle !== null) rows_by_unit[unit].fees_oracle = (rows_by_unit[unit].fees_oracle ?? 0) + row.fees_oracle;
			});

		return Object.values(rows_by_unit).sort((a, b) => {
			const currency_order: Record<string, number> = {btc: 1, sat: 2, msat: 3, usd: 4, eur: 5};
			return (currency_order[a.unit_mint.toLowerCase()] || 999) - (currency_order[b.unit_mint.toLowerCase()] || 999);
		});
	}

	/** Toggles the expanded state for a given unit row */
	public toggleExpanded(unit: string): void {
		this.expanded.update((state) => ({...state, [unit]: !state[unit]}));
	}
}
