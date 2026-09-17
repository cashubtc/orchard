/* Core Dependencies */
import {ChangeDetectionStrategy, Component, input, computed} from '@angular/core';
/* Vendor Dependencies */
import {ValidationErrors} from '@angular/forms';

@Component({
	selector: 'orc-form-error',
	standalone: false,
	templateUrl: './form-error.component.html',
	styleUrl: './form-error.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormErrorComponent {
	public readonly errors = input.required<ValidationErrors | null | undefined>();

	public known_error = computed(() => {
		const errors = this.errors();
		if (!errors) return '';
		if (errors['required']) return 'Required';
		if (errors['maxlength']) return `Must be less than ${errors['maxlength'].requiredLength} characters`;
		if (errors['minlength']) return `Must be at least ${errors['minlength'].requiredLength} characters`;
		if (errors['min']) return `Must be at least ${errors['min']?.min}`;
		if (errors['max']) return `Cannot be greater than ${errors['max']?.max}`;
		if (errors['orchardInteger']) return 'Must be a whole number';
		if (errors['orchardDecimals']) return `Must have ${errors['orchardDecimals'].decimals} decimals`;
		if (errors['orchardMicros']) return 'Invalid format';
		if (errors['orchardUrl']) return 'Must be a valid URL';
		if (errors['orchardOpenrouterKey']) return 'Format: sk-or-v1-{64 hex}';
		if (errors['orchardTelegramBotToken']) return 'Format: {id}:{35-char hash}';
		return '';
	});
}
