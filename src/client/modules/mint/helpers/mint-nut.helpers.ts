/* Native Dependencies */
import {MintNut} from '@client/modules/mint/types/nut.types';
/* Shared Dependencies */
import {OrchardNuts} from '@shared/generated.types';

/**
 * Whether a mint offers a NUT: listed in its info, unless the NUT's own flag turns it off
 * @param {OrchardNuts[MintNut] | undefined} setting - The NUT's setting, absent when the mint doesn't list it
 * @returns {boolean} Whether it's offered
 */
export function isNutOffered(setting: OrchardNuts[MintNut] | undefined): boolean {
	if (!setting) return false;
	if ('supported' in setting && setting.supported === false) return false;
	return !('disabled' in setting && setting.disabled);
}

/**
 * Whether a mint advertises auth: NUT-21 clear or NUT-22 blind
 * @param {OrchardNuts} nuts - The mint's NUT settings
 * @returns {boolean} Whether it does
 */
export function isMintAuthOffered(nuts: OrchardNuts): boolean {
	return isNutOffered(nuts.nut21) || isNutOffered(nuts.nut22);
}
