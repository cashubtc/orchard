/* Application Dependencies */
import {TimezoneType} from '#server/modules/graphql/scalars/timezone.scalar';
import {AnalyticsInterval} from '#server/modules/analytics/analytics.enums';
/* Local Dependencies */
import {LightningAnalyticsMetric} from './lnanalytics.enums.js';

export interface LightningAnalyticsArgs {
	date_start?: number;
	date_end?: number;
	interval?: AnalyticsInterval;
	timezone?: TimezoneType;
	metrics?: LightningAnalyticsMetric[];
}

export interface HourlyMetrics {
	payments_out: bigint;
	invoices_in: bigint;
	forward_fees: bigint;
	channel_opens: bigint;
	channel_closes: bigint;
}

/**
 * Maps asset_id to group_key for Taproot Assets
 */
export type AssetIdToGroupKeyMap = Map<string, string>;
