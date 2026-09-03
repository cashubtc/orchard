/* Application Dependencies */
import {AnalyticsInterval} from '#server/modules/analytics/analytics.enums';
import {MintAnalyticsMetric} from '#server/modules/cashu/mintanalytics/mintanalytics.enums';
import type {TimezoneType} from '#server/modules/graphql/scalars/timezone.scalar';

export interface MintAnalyticsApiArgs {
	date_start?: number;
	date_end?: number;
	interval?: AnalyticsInterval;
	timezone?: TimezoneType;
	units?: string[];
}

export interface MintAnalyticsMetricsArgs extends MintAnalyticsApiArgs {
	metrics?: MintAnalyticsMetric[];
}
