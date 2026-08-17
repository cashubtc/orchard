/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {SystemMetricsService} from '#server/modules/system/metrics/sysmetrics.service';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {SystemMetric, SystemMetricsInterval} from '#server/modules/system/metrics/sysmetrics.enums';
/* Local Dependencies */
import {ApiSystemMetricsService} from './sysmetrics.service.js';

describe('ApiSystemMetricsService', () => {
	let service: ApiSystemMetricsService;
	let systemMetricsService: jest.Mocked<SystemMetricsService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ApiSystemMetricsService,
				{provide: SystemMetricsService, useValue: {getMetrics: jest.fn().mockResolvedValue([])}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		service = module.get<ApiSystemMetricsService>(ApiSystemMetricsService);
		systemMetricsService = module.get(SystemMetricsService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	it('returns empty array when no data', async () => {
		const result = await service.getMetrics('TAG', {});
		expect(result).toEqual([]);
	});

	it('wraps errors via resolveError and throws OrchardApiError', async () => {
		systemMetricsService.getMetrics.mockRejectedValue(new Error('boom'));
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.SystemMetricsError});

		await expect(service.getMetrics('TAG', {})).rejects.toBeInstanceOf(OrchardApiError);
	});

	describe('min/max aggregation', () => {
		it('should set min and max equal to value for minute interval', async () => {
			systemMetricsService.getMetrics.mockResolvedValue([
				{id: '1', metric: SystemMetric.cpu_percent, value: 45.5, date: 1000, updated_at: 1000},
				{id: '2', metric: SystemMetric.cpu_percent, value: 72.3, date: 1060, updated_at: 1060},
			]);

			const result = await service.getMetrics('TAG', {interval: SystemMetricsInterval.minute});

			expect(result[0].min).toBe(45.5);
			expect(result[0].max).toBe(45.5);
			expect(result[1].min).toBe(72.3);
			expect(result[1].max).toBe(72.3);
		});

		it('should compute min and max across values in an hourly bucket', async () => {
			const hour_start = 1710028800; // an exact hour boundary
			systemMetricsService.getMetrics.mockResolvedValue([
				{id: '1', metric: SystemMetric.cpu_percent, value: 20, date: hour_start, updated_at: hour_start},
				{id: '2', metric: SystemMetric.cpu_percent, value: 80, date: hour_start + 60, updated_at: hour_start + 60},
				{id: '3', metric: SystemMetric.cpu_percent, value: 50, date: hour_start + 120, updated_at: hour_start + 120},
			]);

			const result = await service.getMetrics('TAG', {interval: SystemMetricsInterval.hour});

			expect(result).toHaveLength(1);
			expect(result[0].value).toBe(50); // avg of 20, 80, 50
			expect(result[0].min).toBe(20);
			expect(result[0].max).toBe(80);
		});

		it('should compute separate min/max per metric in the same bucket', async () => {
			const hour_start = 1710028800;
			systemMetricsService.getMetrics.mockResolvedValue([
				{id: '1', metric: SystemMetric.cpu_percent, value: 10, date: hour_start, updated_at: hour_start},
				{id: '2', metric: SystemMetric.cpu_percent, value: 90, date: hour_start + 60, updated_at: hour_start + 60},
				{id: '3', metric: SystemMetric.memory_percent, value: 55, date: hour_start, updated_at: hour_start},
				{id: '4', metric: SystemMetric.memory_percent, value: 65, date: hour_start + 60, updated_at: hour_start + 60},
			]);

			const result = await service.getMetrics('TAG', {interval: SystemMetricsInterval.hour});

			const cpu = result.find((r) => r.metric === SystemMetric.cpu_percent);
			const mem = result.find((r) => r.metric === SystemMetric.memory_percent);

			expect(cpu!.min).toBe(10);
			expect(cpu!.max).toBe(90);
			expect(mem!.min).toBe(55);
			expect(mem!.max).toBe(65);
		});
	});
});
