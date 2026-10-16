/* Core Dependencies */
import {ChangeDetectionStrategy, Component, input, output} from '@angular/core';
/* Native Dependencies */
import {CashuUnitChip} from '@client/modules/cashu/types/cashu.types';

@Component({
	selector: 'orc-cashu-unit-chips',
	standalone: false,
	templateUrl: './cashu-unit-chips.component.html',
	styleUrl: './cashu-unit-chips.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashuUnitChipsComponent {
	public readonly chips = input.required<CashuUnitChip[]>();
	public readonly selected = input<string | null>(null);
	public readonly show_unit = input<boolean>(false);
	public readonly selectable = input<boolean>(true);
	public readonly disabled = input<boolean>(false);

	public readonly select = output<string>();
}
