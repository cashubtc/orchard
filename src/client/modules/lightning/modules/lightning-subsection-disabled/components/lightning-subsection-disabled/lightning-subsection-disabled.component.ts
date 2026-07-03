/* Core Dependencies */
import {ChangeDetectionStrategy, Component} from '@angular/core';

@Component({
	selector: 'orc-lightning-subsection-disabled',
	standalone: false,
	templateUrl: './lightning-subsection-disabled.component.html',
	styleUrl: './lightning-subsection-disabled.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LightningSubsectionDisabledComponent {
	public readonly docs_link = 'https://docs.orchard.space/install/configuration/#lightning'; // Official Lightning configuration docs URL.
}
