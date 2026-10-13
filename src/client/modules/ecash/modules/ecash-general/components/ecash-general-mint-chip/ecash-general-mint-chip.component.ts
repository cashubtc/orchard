/* Core Dependencies */
import {ChangeDetectionStrategy, Component, input} from '@angular/core';
/* Native Dependencies */
import {EcashMint} from '@client/modules/ecash/classes/ecash-mint.class';
import {EcashMintStatusPill} from '@client/modules/ecash/modules/ecash-general/types/ecash-general.types';

@Component({
	selector: 'orc-ecash-general-mint-chip',
	standalone: false,
	templateUrl: './ecash-general-mint-chip.component.html',
	styleUrl: './ecash-general-mint-chip.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EcashGeneralMintChipComponent {
	public readonly mint = input.required<EcashMint>();
	public readonly status = input<EcashMintStatusPill | null>(null);
	public readonly balance = input<number | null>(null);
	public readonly unit = input<string>('sat');
}
