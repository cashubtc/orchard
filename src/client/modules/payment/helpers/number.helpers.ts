const MAX_SAFE = BigInt(Number.MAX_SAFE_INTEGER);

/**
 * A bigint as a number, refusing one too large to hold exactly
 * @param {bigint} value - The value to convert
 * @returns {number} The same value as a number
 */
export function toSafeNumber(value: bigint): number {
	if (value > MAX_SAFE) throw new Error('Too large to hold exactly');
	return Number(value);
}
