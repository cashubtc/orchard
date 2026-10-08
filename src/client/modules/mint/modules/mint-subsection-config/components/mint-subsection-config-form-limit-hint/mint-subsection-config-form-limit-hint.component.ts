/* Core Dependencies */
import {ChangeDetectionStrategy, Component, input, effect, signal} from '@angular/core';
/* Application Dependencies */
import {getUnitMeta, toDisplayAmountFor} from '@client/modules/local/helpers/unit.helpers';

@Component({
	selector: 'orc-mint-subsection-config-form-limit-hint',
	standalone: false,
	templateUrl: './mint-subsection-config-form-limit-hint.component.html',
	styleUrl: './mint-subsection-config-form-limit-hint.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintSubsectionConfigFormLimitHintComponent {
	public limit = input.required<number>();
	public amounts = input.required<Record<string, number>[]>();
	public unit = input.required<string>();
	public type = input.required<'min' | 'max'>();

	public limit_hint = signal<number | null>(null);

	constructor() {
		effect(() => {
			const limit = this.limit();
			if (limit) this.setHint();
		});
	}

	private setHint(): void {
		const hint = this.getHint(this.amounts());
		this.limit_hint.set(hint);
	}

	/** Recent quotes outside the limit, compared in display units as the limit is entered */
	private getHint(amounts: Record<string, number>[]): number {
		const meta = getUnitMeta(this.unit());
		const values = amounts.map((amount) => toDisplayAmountFor(meta, amount['amount']));
		if (this.type() === 'min') {
			return values.filter((value) => value < this.limit()).length;
		}
		return values.filter((value) => value > this.limit()).length;
	}
}
