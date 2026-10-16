/* Native Dependencies */
import {CashuMethodDisplay} from '@client/modules/cashu/types/cashu.types';

export const CASHU_METHOD_CUSTOM_ICON = 'money_bag';

/** Presentation for the payment methods Orchard recognizes; anything else falls back to its own name */
export const CASHU_METHOD_DISPLAY: Record<string, CashuMethodDisplay> = {
	bolt11: {label: 'BOLT 11', icon: 'bolt', svg_icon: false},
	bolt12: {label: 'BOLT 12', icon: 'double_bolt', svg_icon: true},
	onchain: {label: 'ONCHAIN', icon: 'deployed_code', svg_icon: false},
};
