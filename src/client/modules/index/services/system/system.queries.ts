export const SYSTEM_INFO_QUERY = `
query SystemInfo {
	system_info {
		os_platform
		os_release
		arch
		cpu_model
		cpu_cores
		memory_total_bytes
		disk_total_bytes
		node_version
		v8_version
		heap_limit_mb
	}
}`;

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
