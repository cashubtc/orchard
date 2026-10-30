/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
/* Shared Dependencies */
import {OrchardNut4Method, OrchardNut5Method, OrchardNuts} from '@shared/generated.types';

/** One method and unit's bounds for minting or melting, in the unit's base units; null when the mint sets none */
type CashuLimit = {
	method: string;
	unit: string;
	min_amount: number | null;
	max_amount: number | null;
};

@Component({
	selector: 'orc-cashu-limits',
	standalone: false,
	templateUrl: './cashu-limits.component.html',
	styleUrl: './cashu-limits.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		'[class.stacked]': 'stacked()',
	},
})
export class CashuLimitsComponent {
	public readonly nuts = input.required<OrchardNuts>();
	public readonly stacked = input<boolean>(false);

	/** Minting method limits from NUT4. */
	public readonly minting_limits = computed(() => this.toLimits(this.nuts().nut4.methods));

	/** Melting method limits from NUT5. */
	public readonly melting_limits = computed(() => this.toLimits(this.nuts().nut5.methods));

	/** Per-unit maximum max_amount across all minting and melting limits. Null means unlimited (skip scaling). */
	private readonly max_by_unit = computed<Map<string, number | null>>(() => {
		const result = new Map<string, number | null>();
		[...this.minting_limits(), ...this.melting_limits()].forEach((limit) => {
			const current = result.get(limit.unit);
			if (limit.max_amount === null) {
				result.set(limit.unit, null);
			} else if (current !== null) {
				result.set(limit.unit, Math.max(current ?? 0, limit.max_amount));
			}
		});
		return result;
	});

	/** Returns the track width percentage for a limit, scaled relative to the largest max_amount in its unit. */
	public getTrackWidthPercent(limit: CashuLimit): number {
		if (limit.max_amount === null) return 100;
		const unit_max = this.max_by_unit().get(limit.unit);
		if (unit_max === null || unit_max === undefined || unit_max === 0) return 100;
		return Math.max(5, (limit.max_amount / unit_max) * 100);
	}

	/** Maps NUT4/NUT5 methods to limit rows. */
	private toLimits(methods: (OrchardNut4Method | OrchardNut5Method)[]): CashuLimit[] {
		return methods.map((method) => ({
			method: method.method,
			unit: method.unit,
			min_amount: method.min_amount ?? null,
			max_amount: method.max_amount ?? null,
		}));
	}
}
