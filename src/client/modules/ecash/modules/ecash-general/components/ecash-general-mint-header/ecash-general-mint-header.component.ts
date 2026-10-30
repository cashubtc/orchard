/* Core Dependencies */
import {ChangeDetectionStrategy, Component, input} from '@angular/core';

@Component({
	selector: 'orc-ecash-general-mint-header',
	standalone: false,
	templateUrl: './ecash-general-mint-header.component.html',
	styleUrl: './ecash-general-mint-header.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EcashGeneralMintHeaderComponent {
	public readonly name = input.required<string>();
	/** The mint's address; null when it has no public URL */
	public readonly subtitle = input.required<string | null>();
	public readonly icon_url = input<string | null>(null);
	public readonly is_orchard = input<boolean>(false);
	public readonly icon_height = input<string>('2.5rem');
	public readonly large = input<boolean>(false);
}
