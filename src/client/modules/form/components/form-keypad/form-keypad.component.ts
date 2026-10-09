/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, input, output} from '@angular/core';

@Component({
	selector: 'orc-form-keypad',
	standalone: false,
	templateUrl: './form-keypad.component.html',
	styleUrl: './form-keypad.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormKeypadComponent {
	public readonly decimal = input<boolean>(false);

	public readonly key = output<string>();

	public readonly keys = computed(() => [...'123456789', ...(this.decimal() ? ['.'] : []), '0', 'backspace']);
}
