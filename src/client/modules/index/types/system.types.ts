/* Shared Dependencies */
import {SystemMetric, SystemMetricsInterval, OrchardSystemMetrics, OrchardSystemInfo} from '@shared/generated.types';

export type SystemMetricsArgs = {
	date_start?: number;
	date_end?: number;
	interval?: SystemMetricsInterval;
	timezone?: string;
	metrics?: SystemMetric[];
};

export type SystemMetricsResponse = {
	system_metrics: OrchardSystemMetrics[];
};

export type SystemInfoResponse = {
	system_info: OrchardSystemInfo;
};

export type SystemInfoTile = {
	value: string;
	caption: string;
};
