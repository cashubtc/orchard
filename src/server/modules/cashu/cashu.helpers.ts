/* Application Dependencies */
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {OrchardErrorCode} from '#server/modules/error/error.types';

/** Cashu units are free-form strings; mints conventionally use lowercase slugs */
const MINT_UNIT_PATTERN = /^[a-z0-9_-]{1,32}$/;

/**
 * Normalizes a client-supplied mint unit to its lowercase slug form.
 * @param {string} unit - The unit as supplied by the caller
 * @returns {string} The normalized unit
 * @throws {OrchardApiError} When the unit is not a valid unit slug
 */
export function normalizeMintUnit(unit: string): string {
	const normalized_unit = unit.trim().toLowerCase();
	if (MINT_UNIT_PATTERN.test(normalized_unit)) return normalized_unit;
	throw new OrchardApiError({
		code: OrchardErrorCode.MintUnitInvalidError,
		details: `Invalid mint unit "${unit}". Units must be 1-32 characters of a-z, 0-9, underscore or hyphen.`,
	});
}

/**
 * Normalizes an optional list of client-supplied mint units.
 * @param {string[]} [units] - The units as supplied by the caller
 * @returns {string[] | undefined} The normalized units, or undefined when none were supplied
 * @throws {OrchardApiError} When any unit is not a valid unit slug
 */
export function normalizeMintUnits(units?: string[]): string[] | undefined {
	return units?.map((unit) => normalizeMintUnit(unit));
}
