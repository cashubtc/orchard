/* Core Dependencies */
import {ChangeDetectionStrategy, Component, output} from '@angular/core';

@Component({
	selector: 'orc-form-keypad',
	standalone: false,
	templateUrl: './form-keypad.component.html',
	styleUrl: './form-keypad.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormKeypadComponent {
	public readonly digit = output<string>();
	public readonly backspace = output<void>();

	public readonly digits: string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
}
