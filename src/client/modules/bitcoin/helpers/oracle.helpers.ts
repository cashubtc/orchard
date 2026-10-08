/* Vendor Dependencies */
import {DateTime} from 'luxon';
/* Application Dependencies */
import {BitcoinOraclePrice} from '@client/modules/bitcoin/classes/bitcoin-oracle-price.class';
import {getUnitMeta, toSats} from '@client/modules/local/helpers/unit.helpers';

export function eligibleForOracleConversion(unit: string): boolean {
	return getUnitMeta(unit).family === 'btc';
}

/** USD cents for an amount in a bitcoin unit's base units; null for other units or without a price */
export function oracleConvertToUSDCents(amount: number | null, price_usd: number | null, unit: string): number | null {
	if (amount === null || price_usd === null) return null;
	const sats = toSats(unit, amount);
	if (sats === null) return null;
	return Math.round((sats / 100_000_000) * price_usd * 100);
}

export function findNearestOraclePrice(oracle_map: Map<number, number>, target_timestamp: number): BitcoinOraclePrice | null {
	if (oracle_map.size === 0) return null;
	const target_day = DateTime.fromSeconds(target_timestamp).startOf('day').toSeconds();
	const exact_match = oracle_map.get(target_day);
	if (exact_match) return new BitcoinOraclePrice({date: target_day, price: exact_match});
	let nearest_price: number | null = null;
	let nearest_date: number = target_day;
	let smallest_diff = Infinity;
	for (const [timestamp, price] of oracle_map) {
		const diff = Math.abs(timestamp - target_day);
		if (diff < smallest_diff) {
			smallest_diff = diff;
			nearest_price = price;
			nearest_date = timestamp;
		}
	}
	return nearest_price !== null ? new BitcoinOraclePrice({date: nearest_date, price: nearest_price}) : null;
}
