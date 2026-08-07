/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {SystemInfoService} from '@server/modules/system/info/sysinfo.service';
import {SystemInfo} from '@server/modules/system/info/sysinfo.types';
import {ErrorService} from '@server/modules/error/error.service';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {ApiSystemInfoService} from './sysinfo.service.js';

const mock_info: SystemInfo = {
	os_platform: 'linux',
	os_release: '6.8.0',
	arch: 'arm64',
	cpu_model: 'Apple M2',
	cpu_cores: 8,
	memory_total_bytes: 17179869184,
	disk_total_bytes: 512000000000,
	node_version: 'v22.3.0',
	v8_version: '12.4.254.21-node.19',
	heap_limit_mb: 4144,
};

describe('ApiSystemInfoService', () => {
	let service: ApiSystemInfoService;
	let systemInfoService: jest.Mocked<SystemInfoService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ApiSystemInfoService,
				{provide: SystemInfoService, useValue: {getSystemInfo: jest.fn().mockResolvedValue(mock_info)}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		service = module.get<ApiSystemInfoService>(ApiSystemInfoService);
		systemInfoService = module.get(SystemInfoService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	it('maps native info to the graphql model', async () => {
		const result = await service.getSystemInfo('TAG');
		expect(result.os_platform).toBe('linux');
		expect(result.cpu_cores).toBe(8);
		expect(result.memory_total_bytes).toBe(17179869184);
		expect(result.heap_limit_mb).toBe(4144);
	});

	it('wraps errors via resolveError and throws OrchardApiError', async () => {
		systemInfoService.getSystemInfo.mockRejectedValue(new Error('boom'));
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.SystemInfoError});

		await expect(service.getSystemInfo('TAG')).rejects.toBeInstanceOf(OrchardApiError);
	});
});
