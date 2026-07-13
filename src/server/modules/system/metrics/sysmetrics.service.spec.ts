/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {getRepositoryToken} from '@nestjs/typeorm';
import {expect} from '@jest/globals';
/* Local Dependencies */
import {SystemMetricsService} from './sysmetrics.service';
import {SystemMetrics} from './sysmetrics.entity';

describe('SystemMetricsService', () => {
	let service: SystemMetricsService;
	let repository: Record<string, jest.Mock>;

	beforeEach(async () => {
		const mock_delete_qb = {
			delete: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			execute: jest.fn().mockResolvedValue({affected: 0}),
		};
		const mock_select_qb = {
			select: jest.fn().mockReturnThis(),
			addSelect: jest.fn().mockReturnThis(),
			where: jest.fn().mockReturnThis(),
			groupBy: jest.fn().mockReturnThis(),
			addGroupBy: jest.fn().mockReturnThis(),
			getRawMany: jest.fn().mockResolvedValue([]),
		};

		repository = {
			find: jest.fn().mockResolvedValue([]),
			upsert: jest.fn().mockResolvedValue(undefined),
			delete: jest.fn().mockResolvedValue({affected: 0}),
			createQueryBuilder: jest.fn().mockImplementation((alias?: string) => {
				return alias ? mock_select_qb : mock_delete_qb;
			}),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SystemMetricsService,
				{
					provide: getRepositoryToken(SystemMetrics),
					useValue: repository,
				},
			],
		}).compile();

		service = module.get<SystemMetricsService>(SystemMetricsService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	describe('collectAndStore', () => {
		it('should batch upsert 12 metrics on the first call (process cpu has no prior sample)', async () => {
			await service.collectAndStore();
			expect(repository.upsert).toHaveBeenCalledTimes(1);
			const rows = repository.upsert.mock.calls[0][0];
			expect(rows).toHaveLength(12);
			expect(rows.map((r: {metric: string}) => r.metric)).not.toContain('process_cpu_percent');
		});

		it('should include process_cpu_percent from the second call onward', async () => {
			await service.collectAndStore();
			await service.collectAndStore();
			const rows = repository.upsert.mock.calls[1][0] as {metric: string; value: number}[];
			expect(rows).toHaveLength(13);
			const process_cpu_row = rows.find((r) => r.metric === 'process_cpu_percent');
			expect(process_cpu_row).toBeDefined();
			expect(process_cpu_row!.value).toBeGreaterThanOrEqual(0);
			expect(process_cpu_row!.value).toBeLessThanOrEqual(100);
		});

		it('should store non-negative memory_external_mb values', async () => {
			await service.collectAndStore();
			const rows = repository.upsert.mock.calls[0][0] as {metric: string; value: number}[];
			const external_row = rows.find((r) => r.metric === 'memory_external_mb');
			expect(external_row).toBeDefined();
			expect(external_row!.value).toBeGreaterThanOrEqual(0);
		});

		it('should upsert with correct conflict paths', async () => {
			await service.collectAndStore();
			const call = repository.upsert.mock.calls[0];
			expect(call[1]).toEqual({conflictPaths: ['metric', 'date']});
		});

		it('should store reasonable cpu_percent values', async () => {
			await service.collectAndStore();
			const rows = repository.upsert.mock.calls[0][0] as {metric: string; value: number}[];
			const cpu_row = rows.find((r) => r.metric === 'cpu_percent');
			expect(cpu_row).toBeDefined();
			expect(cpu_row!.value).toBeGreaterThanOrEqual(0);
			expect(cpu_row!.value).toBeLessThanOrEqual(100);
		});

		it('should store reasonable memory_percent values', async () => {
			await service.collectAndStore();
			const rows = repository.upsert.mock.calls[0][0] as {metric: string; value: number}[];
			const mem_row = rows.find((r) => r.metric === 'memory_percent');
			expect(mem_row).toBeDefined();
			expect(mem_row!.value).toBeGreaterThan(0);
			expect(mem_row!.value).toBeLessThanOrEqual(100);
		});
	});

	describe('getMetrics', () => {
		it('should return empty array when date_end < date_start', async () => {
			const result = await service.getMetrics(1000, 500);
			expect(result).toEqual([]);
			expect(repository.find).not.toHaveBeenCalled();
		});

		it('should query with date range', async () => {
			await service.getMetrics(1000, 2000);
			expect(repository.find).toHaveBeenCalledTimes(1);
		});

		it('should filter by metrics when provided', async () => {
			const {SystemMetric} = await import('./sysmetrics.enums');
			await service.getMetrics(1000, 2000, [SystemMetric.cpu_percent, SystemMetric.memory_percent]);
			expect(repository.find).toHaveBeenCalledTimes(1);
		});
	});

	describe('cleanupOldMetrics', () => {
		it('should delete old records and attempt downsampling via SQL', async () => {
			await service.cleanupOldMetrics();
			expect(repository.delete).toHaveBeenCalledTimes(1);
			// Downsample uses createQueryBuilder with alias for SQL GROUP BY
			expect(repository.createQueryBuilder).toHaveBeenCalledWith('m');
		});
	});
});
