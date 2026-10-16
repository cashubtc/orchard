/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';

@Component({
	selector: 'orc-ecash-general-mint-header',
	standalone: false,
	templateUrl: './ecash-general-mint-header.component.html',
	styleUrl: './ecash-general-mint-header.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EcashGeneralMintHeaderComponent {
	public readonly name = input.required<string>();
	public readonly subtitle = input.required<string>();
	public readonly icon_url = input<string | null>(null);
	public readonly is_orchard = input<boolean>(false);
	public readonly icon_height = input<string>('2.5rem');
	public readonly large = input<boolean>(false);

	/** The subtitle, marking the mint Orchard runs */
	public readonly detail = computed(() => (this.is_orchard() ? `${this.subtitle()} · Your Orchard mint` : this.subtitle()));
}
