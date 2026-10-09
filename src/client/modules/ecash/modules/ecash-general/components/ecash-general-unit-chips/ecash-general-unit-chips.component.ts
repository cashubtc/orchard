/* Core Dependencies */
import {ChangeDetectionStrategy, Component, input, output} from '@angular/core';
/* Native Dependencies */
import {EcashUnitChip} from '@client/modules/ecash/modules/ecash-general/types/ecash-general.types';

@Component({
	selector: 'orc-ecash-general-unit-chips',
	standalone: false,
	templateUrl: './ecash-general-unit-chips.component.html',
	styleUrl: './ecash-general-unit-chips.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EcashGeneralUnitChipsComponent {
	public readonly chips = input.required<EcashUnitChip[]>();
	public readonly selected = input<string | null>(null);
	public readonly show_unit = input<boolean>(false);

	public readonly select = output<string>();
}
