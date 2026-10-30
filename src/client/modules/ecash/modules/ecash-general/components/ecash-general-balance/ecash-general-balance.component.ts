/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input, output} from '@angular/core';
/* Application Dependencies */
import {BitcoinOraclePrice} from '@client/modules/bitcoin/classes/bitcoin-oracle-price.class';
import {oracleConvertToUSDCents} from '@client/modules/bitcoin/helpers/oracle.helpers';
import {DeviceType} from '@client/modules/layout/types/device.types';
import {CashuUnitChip} from '@client/modules/cashu/types/cashu.types';
/* Native Dependencies */
import {EcashBalance} from '@client/modules/ecash/classes/ecash-balance.class';
import {EcashMint} from '@client/modules/ecash/classes/ecash-mint.class';
import {buildUnitChips} from '@client/modules/ecash/modules/ecash-general/helpers/ecash-general.helpers';

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
	public readonly device_type = input<DeviceType>('desktop');
	public readonly selected = input<string | null>(null);
	/** The wallet holds ecash its recovery words were never written down for */
	public readonly backup_due = input<boolean>(false);

	public readonly select = output<string>();
	public readonly backup = output<void>();

	public readonly mobile = computed(() => this.device_type() === 'mobile');

	/** Every unit the wallet's mints offer, with its balance summed across mints; sat alone without mints */
	public readonly chips = computed<Required<CashuUnitChip>[]>(() => {
		const chips = buildUnitChips(
			this.mints().flatMap((mint) => mint.units),
			this.balances(),
		);
		return chips.length > 0 ? chips : [{unit: 'sat', amount: 0}];
	});

	/** The selected unit's balance, its USD value while held, and where it's held */
	public readonly selection = computed(() => {
		const chips = this.chips();
		const chip = chips.find((item) => item.unit === this.selected()) ?? chips[0];
		const oracle_price = this.bitcoin_oracle_enabled() ? (this.bitcoin_oracle_price()?.price ?? null) : null;
		const holdings = this.balances().filter((balance) => balance.unit.toLowerCase() === chip.unit && balance.balance > 0);
		return {
			unit: chip.unit,
			amount: chip.amount,
			amount_oracle: holdings.length > 0 ? oracleConvertToUSDCents(chip.amount, oracle_price, chip.unit) : null,
			caption: this.getHoldingsCaption(holdings.map((holding) => holding.mint_id)),
		};
	});

	/** Names the one mint holding a balance, counts several, or says none does; nothing while that mint isn't loaded yet */
	private getHoldingsCaption(mint_ids: string[]): string | null {
		if (mint_ids.length === 0) return 'No balance on any mint';
		if (mint_ids.length > 1) return `Across ${mint_ids.length} mints`;
		return this.mints().find((mint) => mint.id === mint_ids[0])?.display_name ?? null;
	}
}
