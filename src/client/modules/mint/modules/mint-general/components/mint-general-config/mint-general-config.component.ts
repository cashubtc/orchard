/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';
import {Router} from '@angular/router';
/* Application Dependencies */
import {MintInfo} from '@client/modules/mint/classes/mint-info.class';
import {GraphicStatusState} from '@client/modules/graphic/types/graphic-status.types';
/* Shared Dependencies */
import {OrchardNut4Method, OrchardNut5Method} from '@shared/generated.types';

type MethodLimit = {
	method: string;
	unit: string;
	min_amount: number | null;
	max_amount: number | null;
};

@Component({
	selector: 'orc-mint-general-config',
	standalone: false,
	templateUrl: './mint-general-config.component.html',
	styleUrl: './mint-general-config.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintGeneralConfigComponent {
	private readonly router = inject(Router);

	public info = input.required<MintInfo | null>();

	/** Simplified list of nut numbers and their support status. */
	public nuts = computed(() => {
		const nuts = this.info()?.nuts;
		if (!nuts) return [];
		return Object.entries(nuts)
			.filter(([key]) => key.startsWith('nut'))
			.map(([key, value]) => {
				const number = parseInt(key.replace('nut', ''), 10);
				return {
					number,
					status: this.getNutStatus(number, value),
				};
			});
	});

	/** Deduped payment methods supported across minting (NUT4) and melting (NUT5). */
	public supported_methods = computed<string[]>(() => {
		const methods = [...(this.info()?.nuts?.nut4?.methods ?? []), ...(this.info()?.nuts?.nut5?.methods ?? [])];
		return [...new Set(methods.map((m) => m.method))];
	});

	/** Minting method limits from NUT4. */
	public minting_limits = computed<MethodLimit[]>(() => {
		return this.mapMethodLimits(this.info()?.nuts?.nut4?.methods);
	});

	/** Melting method limits from NUT5. */
	public melting_limits = computed<MethodLimit[]>(() => {
		return this.mapMethodLimits(this.info()?.nuts?.nut5?.methods);
	});

	/** Per-unit maximum max_amount across all minting and melting limits. Null means unlimited (skip scaling). */
	private max_by_unit = computed<Map<string, number | null>>(() => {
		const all_limits = [...this.minting_limits(), ...this.melting_limits()];
		const result = new Map<string, number | null>();
		all_limits.forEach((limit) => {
			const current = result.get(limit.unit);
			if (limit.max_amount === null) {
				result.set(limit.unit, null);
			} else if (current !== null) {
				result.set(limit.unit, Math.max(current ?? 0, limit.max_amount));
			}
		});
		return result;
	});

	/** Navigates to the mint config page and scrolls to the selected nut's section. */
	public onNutClick(nut_number: number): void {
		this.router.navigate(['mint', 'config'], {
			state: {scroll_to: `nav${nut_number}`},
		});
	}

	/** Returns the track width percentage for a limit, scaled relative to the largest max_amount in its unit. */
	public getTrackWidthPercent(limit: MethodLimit): number {
		if (limit.max_amount === null) return 100;
		const unit_max = this.max_by_unit().get(limit.unit);
		if (unit_max === null || unit_max === undefined || unit_max === 0) return 100;
		return Math.max(5, (limit.max_amount / unit_max) * 100);
	}

	/** Derives a status string from a nut number and its value. */
	private getNutStatus(number: number, nut: unknown): GraphicStatusState {
		if (nut == null || typeof nut !== 'object') return number === 4 || number === 5 ? 'inactive' : 'disabled';
		const is_disabled = 'disabled' in nut && (nut as {disabled: boolean}).disabled;
		const is_supported = 'supported' in nut && !!(nut as {supported: unknown}).supported;
		if (number === 4 || number === 5) return is_disabled ? 'inactive' : 'active';
		if ('disabled' in nut) return is_disabled ? 'disabled' : 'enabled';
		if ('supported' in nut) return is_supported ? 'enabled' : 'disabled';
		return 'enabled';
	}

	/** Maps NUT4/NUT5 methods to MethodLimit rows. */
	private mapMethodLimits(methods: (OrchardNut4Method | OrchardNut5Method)[] | undefined): MethodLimit[] {
		if (!methods) return [];
		return methods.map((m) => ({
			method: m.method,
			unit: m.unit,
			min_amount: m.min_amount ?? null,
			max_amount: m.max_amount ?? null,
		}));
	}
}
