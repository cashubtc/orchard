/* Core Dependencies */
import {Field, Float, Int, ObjectType} from '@nestjs/graphql';
/* Native Dependencies */
import {SystemInfo} from '#server/modules/system/info/sysinfo.types';

@ObjectType({description: 'Live host system information'})
export class OrchardSystemInfo {
	@Field({description: 'Operating system platform'})
	os_platform: string;

	@Field({description: 'Operating system kernel release'})
	os_release: string;

	@Field({description: 'CPU architecture'})
	arch: string;

	@Field({description: 'CPU model name'})
	cpu_model: string;

	@Field(() => Int, {description: 'Logical CPU cores available to the process'})
	cpu_cores: number;

	@Field(() => Float, {description: 'Total system memory in bytes'})
	memory_total_bytes: number;

	@Field(() => Float, {description: 'Total root filesystem capacity in bytes'})
	disk_total_bytes: number;

	@Field({description: 'Node.js version'})
	node_version: string;

	@Field({description: 'V8 engine version'})
	v8_version: string;

	@Field(() => Float, {description: 'V8 heap size limit in MB'})
	heap_limit_mb: number;

	constructor(info: SystemInfo) {
		this.os_platform = info.os_platform;
		this.os_release = info.os_release;
		this.arch = info.arch;
		this.cpu_model = info.cpu_model;
		this.cpu_cores = info.cpu_cores;
		this.memory_total_bytes = info.memory_total_bytes;
		this.disk_total_bytes = info.disk_total_bytes;
		this.node_version = info.node_version;
		this.v8_version = info.v8_version;
		this.heap_limit_mb = info.heap_limit_mb;
	}
}
