/* Core Dependencies */
import {FormControl} from '@angular/forms';
/* Local Dependencies */
import {decimals} from './decimals';

describe('decimals validator', () => {
	/** Runs the validator for the given precision against a single value */
	const validate = (places: number, value: unknown) => decimals(places)(new FormControl(value));

	it('should accept whole numbers when places is 0', () => {
		for (const value of ['0', '5', '12', 5, 1000]) expect(validate(0, value)).toBeNull();
	});

	it('should reject decimal points when places is 0', () => {
		for (const value of ['5.', '5.0', '0.5', 5.5]) expect(validate(0, value)).toEqual({orchardDecimals: {decimals: 0}});
	});

	it('should require exactly the given number of decimal places', () => {
		expect(validate(2, '2.15')).toBeNull();
		expect(validate(2, '0.00')).toBeNull();
		for (const value of ['2', '2.', '2.1', '2.155']) expect(validate(2, value)).toEqual({orchardDecimals: {decimals: 2}});
	});

	it('should reject negative and non-numeric values', () => {
		for (const value of ['-5', '-2.15', 'abc', '1e3']) expect(validate(2, value)).not.toBeNull();
		expect(validate(0, '-5')).not.toBeNull();
	});

	it('should leave empty values to the required validator', () => {
		for (const value of [null, undefined, '']) expect(validate(2, value)).toBeNull();
	});
});
