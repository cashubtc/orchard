/* Vendor Dependencies */
import {Amount, type MintInfo} from '@cashu/cashu-ts';

/** Most one mint (NUT-04) or melt (NUT-05) by a method may be at this mint for the unit; Infinity when the mint sets no limit */
export const methodMaxAmount = (info: MintInfo, nut: 4 | 5, method: string, unit: string): number => {
	const setting = info.isSupported(nut).params.find((entry) => entry.method === method && entry.unit === unit);
	return setting?.max_amount ? Amount.from(setting.max_amount).toNumber() : Infinity;
};
