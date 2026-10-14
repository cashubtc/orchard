/* Core Dependencies */
import {ChangeDetectionStrategy, Component, OnDestroy, computed, effect, inject, input, signal, untracked} from '@angular/core';
/* Application Dependencies */
import {SettingDeviceService} from '@client/modules/settings/services/setting-device/setting-device.service';
import {getUnitMeta, getUnitSign, toDisplayAmountFor} from '@client/modules/local/helpers/unit.helpers';
/* Native Dependencies */
import {buildBalanceCells, getBalanceCellsWidth} from '@client/modules/ecash/modules/ecash-general/helpers/ecash-general.helpers';
import {BALANCE_COUNT_MS} from '@client/modules/ecash/modules/ecash-general/constants/ecash-general.constants';

@Component({
	selector: 'orc-ecash-general-balance-amount',
	standalone: false,
	templateUrl: './ecash-general-balance-amount.component.html',
	styleUrl: './ecash-general-balance-amount.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		role: 'status',
		'[attr.aria-label]': 'label()',
		'[class.orc-amount-preceding]': 'sign().before',
		'[class.orc-amount-standard]': '!sign().before',
	},
})
export class EcashGeneralBalanceAmountComponent implements OnDestroy {
	private readonly settingDeviceService = inject(SettingDeviceService);

	public readonly amount = input.required<number>();
	public readonly unit = input.required<string>();

	public readonly sign = computed(() => getUnitSign(this.unit(), this.settingDeviceService.getCurrency()));
	public readonly final_cells = computed(() => buildBalanceCells(this.format(this.amount())));

	/** The full balance for assistive tech, which never hears the count */
	public readonly label = computed(() => {
		const text = this.format(this.amount());
		return this.sign().before ? `${this.sign().text} ${text}` : `${text} ${this.sign().text}`;
	});

	/** The value on screen: counting toward the amount after a change, else the amount itself */
	public readonly cells = computed(() => {
		const count = this.count();
		return count === null ? this.final_cells() : buildBalanceCells(this.format(count));
	});

	/** Holds the wider of the old and new value while counting, so the layout stays put */
	public readonly width = computed(() => (this.count() === null ? getBalanceCellsWidth(this.final_cells()) : this.count_width()));

	private readonly locale = this.settingDeviceService.getLocale();

	private readonly count = signal<number | null>(null);
	private readonly count_width = signal<number>(0);

	private readonly formatter = computed(() => {
		const decimals = getUnitMeta(this.unit()).decimals;
		return new Intl.NumberFormat(this.locale, {minimumFractionDigits: decimals, maximumFractionDigits: decimals});
	});

	private last: {unit: string; amount: number} | null = null;
	private frame = 0;

	constructor() {
		effect(() => {
			const unit = this.unit();
			const amount = this.amount();
			untracked(() => this.onAmount(unit, amount));
		});
	}

	/* *******************************************************
		Animation
	******************************************************** */

	/** Counts a new amount in the same unit from the value on screen; the first amount and a new unit are drawn as they are */
	private onAmount(unit: string, amount: number): void {
		const last = this.last;
		this.last = {unit, amount};
		if (last?.amount === amount && last.unit === unit) return;
		cancelAnimationFrame(this.frame);
		if (!last || last.unit !== unit || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			this.count.set(null);
			return;
		}
		this.countFrom(this.count() ?? last.amount, amount);
	}

	/** Eases the value on screen from one amount to the next */
	private countFrom(from: number, to: number): void {
		const from_width = getBalanceCellsWidth(buildBalanceCells(this.format(from)));
		this.count_width.set(Math.max(from_width, getBalanceCellsWidth(this.final_cells())));
		const started = performance.now();
		const step = (now: number) => {
			const progress = Math.min(1, (now - started) / BALANCE_COUNT_MS);
			if (progress >= 1) {
				this.count.set(null);
				return;
			}
			this.count.set(Math.round(from + (to - from) * (1 - Math.pow(1 - progress, 3))));
			this.frame = requestAnimationFrame(step);
		};
		step(started);
	}

	/** The amount in display units, in the locale's format */
	private format(amount: number): string {
		return this.formatter().format(toDisplayAmountFor(getUnitMeta(this.unit()), amount));
	}

	/* *******************************************************
		Destroy
	******************************************************** */

	ngOnDestroy(): void {
		cancelAnimationFrame(this.frame);
	}
}
