/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';
/* Native Dependencies */
import {FormToggleGroupComponent} from '@client/modules/form/components/form-toggle-group/form-toggle-group.component';

@Component({
	selector: 'orc-form-toggle',
	standalone: false,
	templateUrl: './form-toggle.component.html',
	styleUrl: './form-toggle.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormToggleComponent {
	private readonly group = inject(FormToggleGroupComponent, {optional: true});

	public readonly selected = input<boolean>(false);
	public readonly disabled = input<boolean>(false);

	public readonly small = computed(() => this.group?.size() === 'small');
}
