/* Application Dependencies */
import {eligibleForOracleConversion, oracleConvertToUSDCents, findNearestOraclePrice} from '@client/modules/bitcoin/helpers/oracle.helpers';
import {getUnitMeta} from '@client/modules/local/helpers/unit.helpers';
/* Native Dependencies */
import {OracleChartDataPoint} from '@client/modules/chart/types/chart.types';

/* Re-export generic analytics helpers for backward compatibility */
export {
	type AnalyticsDataPoint,
	type AnalyticsGroup,
	groupAnalyticsByUnit,
	prependData,
	getDataKeyedByTimestamp,
	getAllPossibleTimestamps,
	getNextTimestamp,
	getAmountData,
	getCountData,
	getTimeInterval,
	correctLastPointWithLiveBalance,
} from '@client/modules/chart/helpers/analytics-chart-data.helpers';

/** Gets Y-axis ID for a given unit */
export function getYAxisId(unit: string): string {
	switch (getUnitMeta(unit).family) {
		case 'fiat':
			return 'yfiat';
		case 'custom':
			return 'ycustom';
		default:
			return 'ybtc';
	}
}

/** Converts chart data with oracle prices, storing both original and converted values */
export function convertChartDataWithOracle(
	data: {x: number; y: number}[],
	unit: string,
	oracle_map: Map<number, number> | null,
	use_oracle: boolean,
): OracleChartDataPoint[] {
	const is_eligible = eligibleForOracleConversion(unit);

	return data.map((point) => {
		const timestamp_seconds = point.x / 1000;
		const oracle_price = oracle_map ? findNearestOraclePrice(oracle_map, timestamp_seconds) : null;
		const price = oracle_price?.price || null;
		const converted = is_eligible ? oracleConvertToUSDCents(point.y, price, unit) : null;

		return {
			x: point.x,
			y: use_oracle && converted !== null ? converted : point.y,
			y_original: point.y,
			y_converted: converted,
			unit: unit.toLowerCase(),
		};
	});
}

/** Gets Y-axis ID considering oracle conversion state */
export function getYAxisIdWithOracle(unit: string, oracle_used: boolean): string {
	if (oracle_used && eligibleForOracleConversion(unit)) return 'yfiat';
	return getYAxisId(unit);
}
