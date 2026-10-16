/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input, output} from '@angular/core';
/* Vendor Dependencies */
import {DateTime} from 'luxon';
/* Application Dependencies */
import {BitcoinOraclePrice} from '@client/modules/bitcoin/classes/bitcoin-oracle-price.class';
/* Native Dependencies */
import {EcashOperation} from '@client/modules/ecash/classes/ecash-operation.class';
import {buildActivityGroups} from '@client/modules/ecash/modules/ecash-general/helpers/ecash-general.helpers';

@Component({
	selector: 'orc-ecash-general-activity',
	standalone: false,
	templateUrl: './ecash-general-activity.component.html',
	styleUrl: './ecash-general-activity.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EcashGeneralActivityComponent {
	public readonly operations = input.required<EcashOperation[]>();
	public readonly loading = input<boolean>(false);
	public readonly bitcoin_oracle_enabled = input<boolean>(false);
	public readonly bitcoin_oracle_price = input<BitcoinOraclePrice | null>(null);

	public readonly open = output<EcashOperation>();
	public readonly view_all = output<void>();

	/** The operations grouped by day, then by month, in the device's zone and locale */
	public readonly groups = computed(() => {
		const oracle_price = this.bitcoin_oracle_enabled() ? (this.bitcoin_oracle_price()?.price ?? null) : null;
		return buildActivityGroups(this.operations(), oracle_price, DateTime.now());
	});
}
