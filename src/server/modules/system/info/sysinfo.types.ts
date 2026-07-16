export interface SystemInfo {
	os_platform: string;
	os_release: string;
	arch: string;
	cpu_model: string;
	cpu_cores: number;
	memory_total_bytes: number;
	disk_total_bytes: number;
	node_version: string;
	v8_version: string;
	heap_limit_mb: number;
}
