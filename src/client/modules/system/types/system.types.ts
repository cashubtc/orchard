/* Shared Dependencies */
import {SystemMetricsInterval} from '@shared/generated.types';

export type SystemIntervalOption = {
	label: string;
	value: SystemMetricsInterval;
};

/**
 * Display unit for a system chart. `megabytes` (values already in MB) and `bytes` (values in raw
 * bytes, scaled down by 1024²) share the "MB" suffix but differ in input scale; `seconds` renders as ms.
 */
export type SystemChartUnit = 'count' | 'percent' | 'megabytes' | 'bytes' | 'seconds';

/** Structural shape a system chart datum must satisfy — both SystemMetricSample and MintMetric fit it */
export type SystemChartPoint = {
	metric: string;
	labels?: {name: string; value: string}[];
	date: number;
	value?: number | null;
	p50?: number | null;
	p95?: number | null;
	p99?: number | null;
};
