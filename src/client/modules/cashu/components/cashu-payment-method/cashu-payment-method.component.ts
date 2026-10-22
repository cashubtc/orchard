/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
/* Native Dependencies */
import {getCashuMethodDisplay} from '@client/modules/cashu/helpers/cashu.helpers';

@Component({
	selector: 'orc-cashu-payment-method',
	standalone: false,
	templateUrl: './cashu-payment-method.component.html',
	styleUrl: './cashu-payment-method.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashuPaymentMethodComponent {
	public readonly payment_method = input.required<string>();

	public readonly display = computed(() => getCashuMethodDisplay(this.payment_method()));
}
