/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {getRepositoryToken} from '@nestjs/typeorm';
/* Vendor Dependencies */
import {Repository, SelectQueryBuilder} from 'typeorm';
/* Local Dependencies */
import {EventLogService} from './event.service.js';
import {EventLog} from './event.entity.js';
import {EventLogDetail} from './event-detail.entity.js';
import {EventLogActorType, EventLogSection, EventLogEntityType, EventLogType, EventLogStatus, EventLogDetailStatus} from './event.enums.js';
import type {CreateEventLogInput} from './event.interfaces.js';

/**
 * Test suite for EventLogService
 * Tests all public methods for event log management
 */
describe('EventLogService', () => {
	let service: EventLogService;
	let _event_repository: Repository<EventLog>;
	let _detail_repository: Repository<EventLogDetail>;

	const mock_detail: EventLogDetail = {
		id: 'detail-uuid-1',
		event: {} as EventLog,
		field: 'name',
		old_value: 'old',
		new_value: 'new',
		status: EventLogDetailStatus.SUCCESS,
		error_code: null,
		error_message: null,
	};

	const mock_event: EventLog = {
		id: 'event-uuid-1',
		actor_type: EventLogActorType.USER,
		actor_id: 'user-uuid-1',
		timestamp: 1700000000,
		section: EventLogSection.SETTINGS,
		section_id: null,
		entity_type: EventLogEntityType.INFO,
		entity_id: 'bitcoin.oracle',
		type: EventLogType.UPDATE,
		status: EventLogStatus.SUCCESS,
		details: [mock_detail],
	};

	const mock_event_repository = {
		create: jest.fn(),
		save: jest.fn(),
		findOne: jest.fn(),
		createQueryBuilder: jest.fn(),
	};

	const mock_detail_repository = {
		create: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();

		const module: TestingModule = await Test.createTestingModule({
			providers: [
				EventLogService,
				{
					provide: getRepositoryToken(EventLog),
					useValue: mock_event_repository,
				},
				{
					provide: getRepositoryToken(EventLogDetail),
					useValue: mock_detail_repository,
				},
			],
		}).compile();

		service = module.get<EventLogService>(EventLogService);
		_event_repository = module.get<Repository<EventLog>>(getRepositoryToken(EventLog));
		_detail_repository = module.get<Repository<EventLogDetail>>(getRepositoryToken(EventLogDetail));
	});

	/**
	 * Test service instantiation
	 */
	it('should be defined', () => {
		expect(service).toBeDefined();
	});

	/**
	 * Test createEvent method
	 */
	describe('createEvent', () => {
		it('should create an event log with details', async () => {
			// arrange
			const input: CreateEventLogInput = {
				actor_type: EventLogActorType.USER,
				actor_id: 'user-uuid-1',
				timestamp: 1700000000,
				section: EventLogSection.SETTINGS,
				entity_type: EventLogEntityType.INFO,
				entity_id: 'bitcoin.oracle',
				type: EventLogType.UPDATE,
				status: EventLogStatus.SUCCESS,
				details: [
					{
						field: 'name',
						old_value: 'old',
						new_value: 'new',
						status: EventLogDetailStatus.SUCCESS,
					},
				],
			};
			mock_detail_repository.create.mockReturnValue(mock_detail);
			mock_event_repository.create.mockReturnValue(mock_event);
			mock_event_repository.save.mockResolvedValue(mock_event);

			// act
			const result = await service.createEvent(input);

			// assert
			expect(result).toEqual(mock_event);
			expect(mock_detail_repository.create).toHaveBeenCalledTimes(1);
			expect(mock_event_repository.create).toHaveBeenCalledTimes(1);
			expect(mock_event_repository.save).toHaveBeenCalledTimes(1);
		});

		it('should handle nullable fields with defaults', async () => {
			// arrange
			const input: CreateEventLogInput = {
				actor_type: EventLogActorType.SYSTEM,
				actor_id: 'system',
				timestamp: 1700000000,
				section: EventLogSection.MINT,
				entity_type: EventLogEntityType.INFO,
				entity_id: 'keyset-1',
				type: EventLogType.CREATE,
				status: EventLogStatus.SUCCESS,
				details: [
					{
						field: 'active',
						new_value: 'true',
						status: EventLogDetailStatus.SUCCESS,
					},
				],
			};
			mock_detail_repository.create.mockReturnValue(mock_detail);
			mock_event_repository.create.mockReturnValue(mock_event);
			mock_event_repository.save.mockResolvedValue(mock_event);

			// act
			await service.createEvent(input);

			// assert
			expect(mock_detail_repository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					old_value: null,
					new_value: 'true',
				}),
			);
			expect(mock_event_repository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					section_id: null,
				}),
			);
		});
	});

	/**
	 * Test logEvent method (fire-and-forget audit logging)
	 */
	describe('logEvent', () => {
		const base_input: CreateEventLogInput = {
			actor_type: EventLogActorType.USER,
			actor_id: 'user-uuid-1',
			timestamp: 1700000000,
			section: EventLogSection.SETTINGS,
			entity_type: EventLogEntityType.INFO,
			entity_id: 'bitcoin.oracle',
			type: EventLogType.UPDATE,
			status: EventLogStatus.SUCCESS,
			details: [
				{
					field: 'name',
					old_value: 'old',
					new_value: 'new',
					status: EventLogDetailStatus.SUCCESS,
				},
			],
		};

		it('should skip when details are empty', () => {
			// act
			service.logEvent({...base_input, details: []});

			// assert
			expect(mock_event_repository.create).not.toHaveBeenCalled();
			expect(mock_event_repository.save).not.toHaveBeenCalled();
		});

		it('should call createEvent when details are present', () => {
			// arrange
			mock_detail_repository.create.mockReturnValue(mock_detail);
			mock_event_repository.create.mockReturnValue(mock_event);
			mock_event_repository.save.mockResolvedValue(mock_event);

			// act
			service.logEvent(base_input);

			// assert
			expect(mock_event_repository.create).toHaveBeenCalledTimes(1);
			expect(mock_event_repository.save).toHaveBeenCalledTimes(1);
		});

		it('should swallow repository errors and not throw', async () => {
			// arrange
			mock_detail_repository.create.mockReturnValue(mock_detail);
			mock_event_repository.create.mockReturnValue(mock_event);
			mock_event_repository.save.mockRejectedValue(new Error('db down'));

			// act
			expect(() => service.logEvent(base_input)).not.toThrow();
			// allow the floating promise to settle so the .catch handler runs
			await new Promise((resolve) => setImmediate(resolve));

			// assert
			expect(mock_event_repository.save).toHaveBeenCalledTimes(1);
		});

		it('should log agent-run audit events (AGENT actor, AI section)', () => {
			// arrange
			mock_detail_repository.create.mockReturnValue(mock_detail);
			mock_event_repository.create.mockReturnValue(mock_event);
			mock_event_repository.save.mockResolvedValue(mock_event);

			// act
			service.logEvent({
				...base_input,
				actor_type: EventLogActorType.AGENT,
				actor_id: 'agent-uuid-1',
				section: EventLogSection.AI,
				entity_type: EventLogEntityType.AGENT,
				type: EventLogType.EXECUTE,
			});

			// assert
			expect(mock_event_repository.create).toHaveBeenCalledWith(
				expect.objectContaining({
					actor_type: EventLogActorType.AGENT,
					section: EventLogSection.AI,
					entity_type: EventLogEntityType.AGENT,
					type: EventLogType.EXECUTE,
				}),
			);
		});
	});

	/**
	 * Test getEvents method
	 */
	describe('getEvents', () => {
		let mock_query_builder: Partial<SelectQueryBuilder<EventLog>>;

		beforeEach(() => {
			mock_query_builder = {
				leftJoinAndSelect: jest.fn().mockReturnThis(),
				andWhere: jest.fn().mockReturnThis(),
				orderBy: jest.fn().mockReturnThis(),
				skip: jest.fn().mockReturnThis(),
				take: jest.fn().mockReturnThis(),
				getMany: jest.fn().mockResolvedValue([mock_event]),
			};
			mock_event_repository.createQueryBuilder.mockReturnValue(mock_query_builder);
		});

		it('should return all events without filters', async () => {
			// act
			const result = await service.getEvents();

			// assert
			expect(result).toEqual([mock_event]);
			expect(mock_query_builder.leftJoinAndSelect).toHaveBeenCalledWith('event.details', 'detail');
			expect(mock_query_builder.orderBy).toHaveBeenCalledWith('event.timestamp', 'DESC');
			expect(mock_query_builder.andWhere).not.toHaveBeenCalled();
		});

		it('should apply sections filter', async () => {
			// act
			await service.getEvents({sections: [EventLogSection.BITCOIN]});

			// assert
			expect(mock_query_builder.andWhere).toHaveBeenCalledWith('event.section IN (:...sections)', {
				sections: [EventLogSection.BITCOIN],
			});
		});

		it('should apply pagination', async () => {
			// act
			await service.getEvents({page: 1, page_size: 10});

			// assert
			expect(mock_query_builder.skip).toHaveBeenCalledWith(10);
			expect(mock_query_builder.take).toHaveBeenCalledWith(10);
		});

		it('should apply multiple filters', async () => {
			// act
			await service.getEvents({
				sections: [EventLogSection.SETTINGS],
				actor_types: [EventLogActorType.USER],
				types: [EventLogType.UPDATE],
			});

			// assert
			expect(mock_query_builder.andWhere).toHaveBeenCalledTimes(3);
		});
	});

	/**
	 * Test getEventWithDetails method
	 */
	describe('getEventWithDetails', () => {
		it('should return event with details', async () => {
			// arrange
			mock_event_repository.findOne.mockResolvedValue(mock_event);

			// act
			const result = await service.getEventWithDetails('event-uuid-1');

			// assert
			expect(result).toEqual(mock_event);
			expect(mock_event_repository.findOne).toHaveBeenCalledWith({
				where: {id: 'event-uuid-1'},
				relations: ['details'],
			});
		});

		it('should return null when event not found', async () => {
			// arrange
			mock_event_repository.findOne.mockResolvedValue(null);

			// act
			const result = await service.getEventWithDetails('nonexistent');

			// assert
			expect(result).toBeNull();
		});
	});
});
