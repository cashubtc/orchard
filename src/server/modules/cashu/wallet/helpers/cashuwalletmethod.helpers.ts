/* Vendor Dependencies */
import {Amount, type MintInfo, type SwapMethod} from '@cashu/cashu-ts';

/** A method's mint (NUT-04) or melt (NUT-05) settings at this mint for the unit, when it lists them */
export function methodSetting(info: MintInfo, nut: 4 | 5, method: string, unit: string): SwapMethod | undefined {
	return info.isSupported(nut).params.find((entry) => entry.method === method && entry.unit === unit);
}

/** Most one mint (NUT-04) or melt (NUT-05) by a method may be at this mint for the unit; Infinity when the mint sets no limit */
export function methodMaxAmount(info: MintInfo, nut: 4 | 5, method: string, unit: string): number {
	const setting = methodSetting(info, nut, method, unit);
	return setting?.max_amount ? Amount.from(setting.max_amount).toNumber() : Infinity;
}

/** Least one mint (NUT-04) or melt (NUT-05) by a method may be at this mint for the unit; 0 when the mint sets no minimum */
export function methodMinAmount(info: MintInfo, nut: 4 | 5, method: string, unit: string): number {
	const setting = methodSetting(info, nut, method, unit);
	return setting?.min_amount ? Amount.from(setting.min_amount).toNumber() : 0;
}
