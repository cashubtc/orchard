/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input, output} from '@angular/core';
/* Native Dependencies */
import {CashuMethodChip} from '@client/modules/cashu/types/cashu.types';
import {getCashuMethodDisplay} from '@client/modules/cashu/helpers/cashu.helpers';

@Component({
	selector: 'orc-cashu-method-chips',
	standalone: false,
	templateUrl: './cashu-method-chips.component.html',
	styleUrl: './cashu-method-chips.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashuMethodChipsComponent {
	public readonly methods = input.required<string[]>();
	public readonly selected = input<string | null>(null);
	public readonly selectable = input<boolean>(true);
	public readonly disabled = input<boolean>(false);

	public readonly select = output<string>();

	public readonly chips = computed<CashuMethodChip[]>(() =>
		this.methods().map((method) => ({method, display: getCashuMethodDisplay(method)})),
	);
}
