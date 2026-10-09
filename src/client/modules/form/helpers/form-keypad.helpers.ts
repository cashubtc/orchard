/**
 * Applies a keypad key to the amount typed so far
 * @param {string} text - The amount typed so far, with '.' as its decimal point
 * @param {string} key - A digit, '.' or 'backspace'
 * @param {number} decimals - Fraction digits the unit allows
 * @returns {string} The new text, unchanged when the key would make it invalid
 */
export function applyKeypadKey(text: string, key: string, decimals: number): string {
	if (key === 'backspace') return text.slice(0, -1);
	if (key === '.') return decimals === 0 || text.includes('.') ? text : `${text || '0'}.`;
	const next = `${text}${key}`.replace(/^0(?=\d)/, '');
	if (next === '0') return text;
	const [integer, fraction = ''] = next.split('.');
	if (fraction.length > decimals || Number(integer) > Number.MAX_SAFE_INTEGER) return text;
	return next;
}
