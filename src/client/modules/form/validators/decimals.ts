/* Core Dependencies */
import {AbstractControl, ValidationErrors, ValidatorFn} from '@angular/forms';

/** Requires a value with at most the given number of decimal places (a whole number when places is 0) */
export function decimals(places: number): ValidatorFn {
	const fraction = places > 0 ? `(\\.\\d{1,${places}})?` : '';
	const regex = new RegExp(`^\\d+${fraction}$`);
	return (control: AbstractControl): ValidationErrors | null => {
		const value = control.value;
		if (value === null || value === undefined || value === '') return null;
		return regex.test(value.toString()) ? null : {orchardDecimals: {decimals: places}};
	};
}
