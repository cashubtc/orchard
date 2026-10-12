/* Core Dependencies */
import {ChangeDetectionStrategy, Component, input} from '@angular/core';

@Component({
	selector: 'orc-mint-general-balance-stacks',
	standalone: false,
	templateUrl: './mint-general-balance-stacks.component.html',
	styleUrl: './mint-general-balance-stacks.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MintGeneralBalanceStacksComponent {
	public assets = input.required<number>();
	public liabilities = input.required<number>();
	public unit = input.required<string>();
	public solvency = input.required<number | null>();
}
