/* Application Dependencies */
import {AnalyticsInterval} from '#server/modules/analytics/analytics.enums';
import {TimezoneType} from '#server/modules/graphql/scalars/timezone.scalar';
/* Native Dependencies */
import {LightningAnalyticsMetric} from '#server/modules/lightning/analytics/lnanalytics.enums';

export interface LightningAnalyticsApiArgs {
	date_start?: number;
	date_end?: number;
	interval?: AnalyticsInterval;
	timezone?: TimezoneType;
}

export interface LightningAnalyticsMetricsArgs extends LightningAnalyticsApiArgs {
	metrics?: LightningAnalyticsMetric[];
}
