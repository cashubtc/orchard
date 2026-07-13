export enum SystemMetric {
	cpu_percent = 'cpu_percent',
	memory_percent = 'memory_percent',
	memory_rss_mb = 'memory_rss_mb',
	disk_percent = 'disk_percent',
	load_avg_1m = 'load_avg_1m',
	load_avg_5m = 'load_avg_5m',
	load_avg_15m = 'load_avg_15m',
	heap_used_mb = 'heap_used_mb',
	heap_total_mb = 'heap_total_mb',
	uptime_system = 'uptime_system',
	uptime_process = 'uptime_process',
}

export enum SystemMetricsInterval {
	minute = 'minute',
	hour = 'hour',
	day = 'day',
}
