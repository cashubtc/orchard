/* Core Dependencies */
import {ChangeDetectionStrategy, Component, DestroyRef, OnInit, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';
/* Application Dependencies */
import {SettingAppService} from '@client/modules/settings/services/setting-app/setting-app.service';
import {BitcoinService} from '@client/modules/bitcoin/services/bitcoin/bitcoin.service';
import {BitcoinOraclePrice} from '@client/modules/bitcoin/classes/bitcoin-oracle-price.class';
/* Native Dependencies */
import {EcashService} from '@client/modules/ecash/services/ecash/ecash.service';
import {EcashBalance} from '@client/modules/ecash/classes/ecash-balance.class';

@Component({
	selector: 'orc-ecash-subsection-wallet',
	standalone: false,
	templateUrl: './ecash-subsection-wallet.component.html',
	styleUrl: './ecash-subsection-wallet.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EcashSubsectionWalletComponent implements OnInit {
	private readonly ecashService = inject(EcashService);
	private readonly bitcoinService = inject(BitcoinService);
	private readonly settingAppService = inject(SettingAppService);
	private readonly destroyRef = inject(DestroyRef);

	public readonly bitcoin_oracle_enabled: boolean = this.settingAppService.getSetting('bitcoin_oracle').value;

	public readonly balances = signal<EcashBalance[]>([]);
	public readonly bitcoin_oracle_price = signal<BitcoinOraclePrice | null>(null);
	public readonly loading_balances = signal<boolean>(true);

	ngOnInit(): void {
		this.loadBalances();
		if (this.bitcoin_oracle_enabled) this.loadBitcoinOraclePrice();
	}

	/* *******************************************************
		Data
	******************************************************** */

	private loadBalances(): void {
		this.ecashService
			.loadBalances()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe({
				next: (balances) => {
					this.balances.set(balances);
					this.loading_balances.set(false);
				},
				error: (error) => {
					console.error(error);
					this.loading_balances.set(false);
				},
			});
	}

	private loadBitcoinOraclePrice(): void {
		this.bitcoinService
			.loadBitcoinOraclePrice()
			.pipe(takeUntilDestroyed(this.destroyRef))
			.subscribe((price) => this.bitcoin_oracle_price.set(price));
	}
}
