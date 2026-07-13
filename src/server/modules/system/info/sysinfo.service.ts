/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
import * as os from 'os';
import * as v8 from 'v8';
import {promises as fs} from 'fs';
/* Application Dependencies */
import {round2} from '@server/modules/math/round';
/* Local Dependencies */
import {SystemInfo} from './sysinfo.types';

@Injectable()
export class SystemInfoService {
	private readonly logger = new Logger(SystemInfoService.name);

	/**
	 * Reads live host, os and runtime facts at query time
	 */
	async getSystemInfo(): Promise<SystemInfo> {
		return {
			os_platform: os.platform(),
			os_release: os.release(),
			arch: os.arch(),
			cpu_model: os.cpus()[0]?.model ?? 'unknown',
			cpu_cores: os.availableParallelism(),
			memory_total_bytes: os.totalmem(),
			disk_total_bytes: await this.getDiskTotalBytes(),
			node_version: process.version,
			v8_version: process.versions.v8,
			heap_limit_mb: round2(v8.getHeapStatistics().heap_size_limit / (1024 * 1024)),
		};
	}

	/**
	 * Gets total disk capacity for the root filesystem
	 */
	private async getDiskTotalBytes(): Promise<number> {
		try {
			const stats = await fs.statfs('/');
			return stats.blocks * stats.bsize;
		} catch (error) {
			this.logger.warn(`Failed to read disk stats: ${error.message}`);
			return 0;
		}
	}
}
