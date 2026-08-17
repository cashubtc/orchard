/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {EventLogService} from '#server/modules/event/event.service';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {ApiEventLogService} from './event.service.js';
import {OrchardEventLog} from './event.model.js';
import {OrchardCommonCount} from '#server/modules/api/common/entity-count.model';

describe('ApiEventLogService', () => {
	let service: ApiEventLogService;
	let eventLogService: jest.Mocked<EventLogService>;
	let errorService: jest.Mocked<ErrorService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				ApiEventLogService,
				{provide: EventLogService, useValue: {getEvents: jest.fn(), getEventCount: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
			],
		}).compile();

		service = module.get<ApiEventLogService>(ApiEventLogService);
		eventLogService = module.get(EventLogService);
		errorService = module.get(ErrorService);
	});

	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	it('returns OrchardEventLog[] on success', async () => {
		const mock_event = {
			id: '1',
			actor_type: 'user',
			actor_id: 'u1',
			timestamp: 100,
			section: 'settings',
			section_id: null,
			entity_type: 'setting',
			entity_id: null,
			type: 'update',
			status: 'success',
			details: [],
		};
		eventLogService.getEvents.mockResolvedValue([mock_event as any]);

		const result = await service.getEventLogs('TAG');

		expect(result).toHaveLength(1);
		expect(result[0]).toBeInstanceOf(OrchardEventLog);
	});

	it('wraps getEventLogs errors via resolveError and throws OrchardApiError', async () => {
		eventLogService.getEvents.mockRejectedValue(new Error('db error'));
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.EventLogError});

		await expect(service.getEventLogs('TAG')).rejects.toBeInstanceOf(OrchardApiError);
		expect(errorService.resolveError).toHaveBeenCalled();
	});

	it('returns OrchardCommonCount on success', async () => {
		eventLogService.getEventCount.mockResolvedValue(42);

		const result = await service.getEventLogCount('TAG');

		expect(result).toBeInstanceOf(OrchardCommonCount);
		expect(result.count).toBe(42);
	});

	it('wraps getEventLogCount errors via resolveError and throws OrchardApiError', async () => {
		eventLogService.getEventCount.mockRejectedValue(new Error('db error'));
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.EventLogError});

		await expect(service.getEventLogCount('TAG')).rejects.toBeInstanceOf(OrchardApiError);
	});
});
