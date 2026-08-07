/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {promises as fs} from 'fs';
/* Local Dependencies */
import {SystemInfoService} from './sysinfo.service.js';

describe('SystemInfoService', () => {
	let service: SystemInfoService;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [SystemInfoService],
		}).compile();

		service = module.get<SystemInfoService>(SystemInfoService);
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('getSystemInfo', () => {
		it('should return live host facts with sane shapes', async () => {
			const info = await service.getSystemInfo();
			expect(info.os_platform.length).toBeGreaterThan(0);
			expect(info.os_release.length).toBeGreaterThan(0);
			expect(info.arch.length).toBeGreaterThan(0);
			expect(info.cpu_model.length).toBeGreaterThan(0);
			expect(info.cpu_cores).toBeGreaterThanOrEqual(1);
			expect(info.memory_total_bytes).toBeGreaterThan(0);
			expect(info.node_version).toMatch(/^v\d+\./);
			expect(info.v8_version).toMatch(/^\d+\./);
			expect(info.heap_limit_mb).toBeGreaterThan(0);
		});

		it('should return positive disk capacity when statfs succeeds', async () => {
			const info = await service.getSystemInfo();
			expect(info.disk_total_bytes).toBeGreaterThan(0);
		});

		it('should return 0 disk capacity when statfs fails', async () => {
			jest.spyOn(fs, 'statfs').mockRejectedValue(new Error('boom'));
			const info = await service.getSystemInfo();
			expect(info.disk_total_bytes).toBe(0);
		});
	});
});
