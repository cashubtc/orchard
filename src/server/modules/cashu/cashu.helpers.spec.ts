/* Core Dependencies */
import {expect} from '@jest/globals';
/* Local Dependencies */
import {normalizeMintUnit, normalizeMintUnits} from './cashu.helpers.js';

/**
 * Test suite for cashu helpers
 * Tests normalization and validation of free-form mint units
 */
describe('Cashu Helpers', () => {
	/* *******************************************************
		normalizeMintUnit
	******************************************************** */

	describe('normalizeMintUnit', () => {
		it('should pass through a known unit', () => {
			expect(normalizeMintUnit('sat')).toBe('sat');
		});

		it('should pass through a custom unit', () => {
			expect(normalizeMintUnit('ora')).toBe('ora');
		});

		it('should allow underscores, hyphens and digits', () => {
			expect(normalizeMintUnit('my_unit-2')).toBe('my_unit-2');
		});

		it('should lowercase and trim', () => {
			expect(normalizeMintUnit('  ORA ')).toBe('ora');
		});

		it('should throw on an empty unit', () => {
			expect(() => normalizeMintUnit('')).toThrow();
		});

		it('should throw on a unit over 32 characters', () => {
			expect(() => normalizeMintUnit('a'.repeat(33))).toThrow();
		});

		it('should throw on a unit with illegal characters', () => {
			expect(() => normalizeMintUnit("sat' OR 1=1")).toThrow();
		});
	});

	/* *******************************************************
		normalizeMintUnits
	******************************************************** */

	describe('normalizeMintUnits', () => {
		it('should return undefined when no units are supplied', () => {
			expect(normalizeMintUnits(undefined)).toBeUndefined();
		});

		it('should normalize every unit in the list', () => {
			expect(normalizeMintUnits(['SAT', 'ora'])).toEqual(['sat', 'ora']);
		});

		it('should throw when any unit is invalid', () => {
			expect(() => normalizeMintUnits(['sat', 'not a unit'])).toThrow();
		});
	});
});
