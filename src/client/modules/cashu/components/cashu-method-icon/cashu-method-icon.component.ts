/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input} from '@angular/core';
/* Native Dependencies */
import {CashuMethodDisplay} from '@client/modules/cashu/types/cashu.types';

@Component({
	selector: 'orc-cashu-method-icon',
	standalone: false,
	templateUrl: './cashu-method-icon.component.html',
	styleUrl: './cashu-method-icon.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CashuMethodIconComponent {
	public readonly display = input.required<CashuMethodDisplay>();
	public readonly size = input<'sm' | 'md' | 'lg' | null>('sm');

	public readonly size_class = computed(() => (this.size() ? `icon-${this.size()}` : ''));
}
