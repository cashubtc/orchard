/* Core Dependencies */
import {ChangeDetectionStrategy, Component, input} from '@angular/core';

@Component({
	selector: 'orc-form-toggle-group',
	standalone: false,
	templateUrl: './form-toggle-group.component.html',
	styleUrl: './form-toggle-group.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		'[class.small]': "size() === 'small'",
	},
})
export class FormToggleGroupComponent {
	// Its toggles read this too, so a small group needs no input on each toggle
	public readonly size = input<'medium' | 'small'>('medium');
}
