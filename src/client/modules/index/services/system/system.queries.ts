export const SYSTEM_METRICS_QUERY = `
query SystemMetrics($date_start: UnixTimestamp, $date_end: UnixTimestamp, $interval: SystemMetricsInterval, $timezone: Timezone, $metrics: [SystemMetric!]) {
	system_metrics(date_start: $date_start, date_end: $date_end, interval: $interval, timezone: $timezone, metrics: $metrics) {
		metric
		date
		value
		min
		max
	}
}`;
