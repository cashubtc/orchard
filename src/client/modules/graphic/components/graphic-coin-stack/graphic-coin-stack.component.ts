/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
/* Application Dependencies */
import {getUnitMeta} from '@client/modules/local/helpers/unit.helpers';
/* Native Dependencies */
import {buildCoinStackRows, getCoinStackSize} from '@client/modules/graphic/helpers/graphic-coin-stack.helpers';

@Component({
	selector: 'orc-graphic-coin-stack',
	standalone: false,
	templateUrl: './graphic-coin-stack.component.html',
	styleUrl: './graphic-coin-stack.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GraphicCoinStackComponent {
	public readonly unit = input.required<string>();
	public readonly value = input.required<number>();
	public readonly counterpart = input.required<number>();

	public readonly unit_class = computed(() => `coin-${getUnitMeta(this.unit()).asset}`);
	public readonly rows = computed(() => buildCoinStackRows(getCoinStackSize(this.value(), this.counterpart())));
}
