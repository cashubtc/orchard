/* Native Dependencies */
import {CASHU_METHOD_CUSTOM_ICON, CASHU_METHOD_DISPLAY} from '@client/modules/cashu/constants/cashu.constants';
import {CashuMethodDisplay} from '@client/modules/cashu/types/cashu.types';

/**
 * Label and icon for a payment method, labels uppercase; methods Orchard doesn't recognize show the mint's own name for them
 * @param {string | null} method - The payment method
 * @returns {CashuMethodDisplay} The method's presentation
 */
export function getCashuMethodDisplay(method: string | null): CashuMethodDisplay {
	return CASHU_METHOD_DISPLAY[method ?? ''] ?? {label: (method ?? '').toUpperCase(), icon: CASHU_METHOD_CUSTOM_ICON, svg_icon: false};
}
