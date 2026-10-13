/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input, linkedSignal} from '@angular/core';
/* Application Dependencies */
import {getUnitMeta} from '@client/modules/local/helpers/unit.helpers';
/* Native Dependencies */
import {buildCoinStackRows, getCoinStackSize, orderCoinStackDrops} from '@client/modules/graphic/helpers/graphic-coin-stack.helpers';

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

	/** The stack being replaced, sinking away while the new one drops in */
	public readonly leaving = linkedSignal<number[][][], number[][][] | null>({
		source: () => this.drops(),
		computation: (_, previous) => previous?.source ?? null,
	});

	public readonly unit_class = computed(() => `coin-${getUnitMeta(this.unit()).asset}`);
	/** The count alone sets the shape, so values that keep it keep every coin in place */
	public readonly coin_count = computed(() => getCoinStackSize(this.value(), this.counterpart()));
	public readonly drops = computed(() => orderCoinStackDrops(buildCoinStackRows(this.coin_count())));
	/** The replaced stack, while it sinks away, then the live one; tracked by identity, so a new shape mounts fresh coins */
	public readonly layers = computed(() => {
		const leaving = this.leaving();
		return leaving ? [leaving, this.drops()] : [this.drops()];
	});

	/* *******************************************************
		Animation
	******************************************************** */

	/** Lets go of the replaced stack once it has sunk away */
	public onLeft(event: AnimationEvent): void {
		if (event.target === event.currentTarget) this.leaving.set(null);
	}
}
