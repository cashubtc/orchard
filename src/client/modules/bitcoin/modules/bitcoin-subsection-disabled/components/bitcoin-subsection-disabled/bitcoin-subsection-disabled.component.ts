/* Core Dependencies */
import {ChangeDetectionStrategy, Component} from '@angular/core';

@Component({
	selector: 'orc-bitcoin-subsection-disabled',
	standalone: false,
	templateUrl: './bitcoin-subsection-disabled.component.html',
	styleUrl: './bitcoin-subsection-disabled.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BitcoinSubsectionDisabledComponent {
	public readonly docs_link = 'https://docs.orchard.space/install/configuration/#bitcoin'; // Official Bitcoin configuration docs URL.
}
