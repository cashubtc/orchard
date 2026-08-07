/* Application Dependencies */
import {AnalyticsInterval} from '#server/modules/analytics/analytics.enums';
import {TimezoneType} from '#server/modules/graphql/scalars/timezone.scalar';
/* Native Dependencies */
import {BitcoinAnalyticsMetric} from '#server/modules/bitcoin/analytics/btcanalytics.enums';

export interface BitcoinAnalyticsApiArgs {
	date_start?: number;
	date_end?: number;
	interval?: AnalyticsInterval;
	timezone?: TimezoneType;
}

export interface BitcoinAnalyticsMetricsArgs extends BitcoinAnalyticsApiArgs {
	metrics?: BitcoinAnalyticsMetric[];
}
