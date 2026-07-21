/* Core Dependencies */
import {ChangeDetectionStrategy, Component} from '@angular/core';

@Component({
	selector: 'orc-mint-subsection-system-disabled',
	standalone: false,
	templateUrl: './mint-subsection-system-disabled.component.html',
	styleUrl: './mint-subsection-system-disabled.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSubsectionSystemDisabledComponent {
	public readonly docs_link = 'https://docs.orchard.space/install/configuration/#cashu-mint'; // Official mint metrics configuration docs URL.
}
