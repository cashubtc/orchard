/* Core Dependencies */
import {ChangeDetectionStrategy, Component} from '@angular/core';

@Component({
	selector: 'orc-mint-subsection-disabled',
	standalone: false,
	templateUrl: './mint-subsection-disabled.component.html',
	styleUrl: './mint-subsection-disabled.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSubsectionDisabledComponent {
	public readonly docs_link = 'https://docs.orchard.space/install/configuration/#cashu-mint'; // Official Cashu Mint configuration docs URL.
}
