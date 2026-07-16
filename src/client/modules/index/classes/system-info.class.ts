/* Shared Dependencies */
import {OrchardSystemInfo} from '@shared/generated.types';

export class SystemInfo implements OrchardSystemInfo {
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

	constructor(osi: OrchardSystemInfo) {
		this.os_platform = osi.os_platform;
		this.os_release = osi.os_release;
		this.arch = osi.arch;
		this.cpu_model = osi.cpu_model;
		this.cpu_cores = osi.cpu_cores;
		this.memory_total_bytes = osi.memory_total_bytes;
		this.disk_total_bytes = osi.disk_total_bytes;
		this.node_version = osi.node_version;
		this.v8_version = osi.v8_version;
		this.heap_limit_mb = osi.heap_limit_mb;
	}
}
