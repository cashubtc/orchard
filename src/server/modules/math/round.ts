/** Rounds a number to 2 decimal places */
export function round2(n: number): number {
	return Math.round(n * 100) / 100;
}
