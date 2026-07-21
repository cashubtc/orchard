/* Core Dependencies */
import {ChangeDetectionStrategy, Component} from '@angular/core';

@Component({
	selector: 'orc-bitcoin-subsection-oracle-disabled',
	standalone: false,
	templateUrl: './bitcoin-subsection-oracle-disabled.component.html',
	styleUrl: './bitcoin-subsection-oracle-disabled.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BitcoinSubsectionOracleDisabledComponent {
	public readonly settings_link = '/settings/app'; // App settings page where the bitcoin_oracle toggle lives.
}
