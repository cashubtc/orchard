/* Shared Dependencies */
import {OrchardNuts} from '@shared/generated.types';

/**
 * Every payment method a mint mints or melts with, once each
 * @param {OrchardNuts} nuts - The mint's NUT settings
 * @returns {string[]} The methods, minting's first
 */
export function getMintMethods(nuts: OrchardNuts): string[] {
	return [...new Set([...nuts.nut4.methods, ...nuts.nut5.methods].map((method) => method.method))];
}
