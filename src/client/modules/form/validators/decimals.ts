/* Core Dependencies */
import {AbstractControl, ValidationErrors, ValidatorFn} from '@angular/forms';

/** Requires a value written with exactly the given number of decimal places */
export function decimals(places: number): ValidatorFn {
	const regex = new RegExp(`^\\d+\\.\\d{${places}}$`);
	return (control: AbstractControl): ValidationErrors | null => {
		const value = control.value;
		if (value === null || value === undefined || value === '') return null;
		return regex.test(value.toString()) ? null : {orchardDecimals: {decimals: places}};
	};
}
