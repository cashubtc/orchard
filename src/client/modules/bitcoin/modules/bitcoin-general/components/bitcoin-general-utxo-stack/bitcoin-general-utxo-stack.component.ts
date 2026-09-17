/* Core Dependencies */
import {ChangeDetectionStrategy, Component, input, computed} from '@angular/core';
/* Application Dependencies */
import {ConfigService} from '@client/modules/config/services/config.service';

@Component({
	selector: 'orc-bitcoin-general-utxo-stack',
	standalone: false,
	templateUrl: './bitcoin-general-utxo-stack.component.html',
	styleUrl: './bitcoin-general-utxo-stack.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BitcoinGeneralUtxoStackComponent {
	public unit = input.required<string>();
	public coins = input.required<number>();
	public group_key = input<string | undefined>();

	public limiter = 10;

	public asset_class = computed(() => {
		const lower_unit = this.unit().toLowerCase();
		const group_key = this.group_key();
		if (group_key === this.taproot_group_keys['usdt']) return 'utxo-asset-tether';
		if (lower_unit === 'sat' || lower_unit === 'msat' || lower_unit === 'btc') return 'utxo-asset-btc';
		return 'utxo-asset-custom';
	});

	public overflow_class = computed(() => {
		const lower_unit = this.unit().toLowerCase();
		const group_key = this.group_key();
		if (group_key === this.taproot_group_keys['usdt']) return 'utxo-overflow-tether';
		if (lower_unit === 'sat' || lower_unit === 'msat' || lower_unit === 'btc') return 'utxo-overflow-btc';
		return 'utxo-overflow-custom';
	});

	public coin_array = computed(() => {
		const coins = this.coins();
		const count = Math.min(coins - 1, this.limiter - 1);
		return Array.from({length: count}, (_, i) => i);
	});

	/** Computes the min-width (in rem) to reserve space for the fully expanded stack */
	public stack_min_width = computed(() => {
		const icon_width = this.coins() > this.limiter ? 1.5 : 0;
		return this.coin_array().length * 0.5 + 2 + icon_width;
	});

	private taproot_group_keys: Record<string, string>;

	constructor(private configService: ConfigService) {
		this.taproot_group_keys = this.configService.config.constants.taproot_group_keys;
	}
}
