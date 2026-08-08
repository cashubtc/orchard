/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {Reflector} from '@nestjs/core';
import {CallHandler, ExecutionContext} from '@nestjs/common';
import {expect} from '@jest/globals';
/* Vendor Dependencies */
import {of, throwError, lastValueFrom} from 'rxjs';
/* Application Dependencies */
import {EventLogService} from '#server/modules/event/event.service';
import type {EventLogMetadata} from '#server/modules/event/event.decorator';
import {
	EventLogActorType,
	EventLogSection,
	EventLogEntityType,
	EventLogType,
	EventLogStatus,
	EventLogDetailStatus,
} from '#server/modules/event/event.enums';
import {CashuMintDatabaseService} from '#server/modules/cashu/mintdb/cashumintdb.service';
import {MintService} from '#server/modules/api/mint/mint.service';
/* Local Dependencies */
import {MintKeysetInterceptor} from './mintkeyset.interceptor.js';

/** Flush pending microtasks (awaits floating async promises in tap callbacks) */
const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

/**
 * Test suite for MintKeysetInterceptor
 * Tests event logging for keyset rotation (logs both old keyset deactivation and new keyset creation)
 */
describe('MintKeysetInterceptor', () => {
	let interceptor: MintKeysetInterceptor;
	let reflector: jest.Mocked<Reflector>;
	let eventLogService: jest.Mocked<EventLogService>;
	let cashuMintDatabaseService: jest.Mocked<CashuMintDatabaseService>;
	let mintService: jest.Mocked<MintService>;

	const mock_user_id = 'user-123';

	const mock_metadata: EventLogMetadata = {
		type: EventLogType.CREATE,
		field: 'keyset',
	};

	const mock_old_keyset = {
		id: 'old-keyset-001',
		unit: 'sat',
		derivation_path_index: 0,
		active: true,
	};

	const mock_new_keyset = {
		id: 'new-keyset-002',
		unit: 'sat',
		derivation_path_index: 1,
		active: true,
	};

	const mock_rotation_result = {
		id: 'new-keyset-002',
		unit: 'sat',
		amounts: [1, 2, 4, 8, 16],
		input_fee_ppk: 100,
	};

	/** Creates a mock ExecutionContext for GraphQL resolvers */
	const createMockContext = (args: Record<string, any> = {}, user_id: string = mock_user_id): ExecutionContext => {
		return {
			getHandler: jest.fn(),
			getClass: jest.fn(),
			getArgs: jest.fn().mockReturnValue([null, args, {req: {user: {id: user_id}}}, null]),
			getType: jest.fn().mockReturnValue('graphql'),
			switchToHttp: jest.fn(),
			switchToRpc: jest.fn(),
			switchToWs: jest.fn(),
			getArgByIndex: jest.fn(),
		} as unknown as ExecutionContext;
	};

	const createMockCallHandler = (result: any = {}): CallHandler => ({
		handle: jest.fn().mockReturnValue(of(result)),
	});

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				MintKeysetInterceptor,
				{
					provide: Reflector,
					useValue: {get: jest.fn()},
				},
				{
					provide: EventLogService,
					useValue: {
						createEvent: jest.fn().mockResolvedValue({}),
						logEvent: jest.fn().mockImplementation(function (this: any, input: any) {
							if (input.details.length === 0) return;
							this.createEvent(input).catch(() => {});
						}),
					},
				},
				{
					provide: CashuMintDatabaseService,
					useValue: {getKeysets: jest.fn()},
				},
				{
					provide: MintService,
					useValue: {
						withDbClient: jest.fn().mockImplementation((fn) => fn('mock-client')),
					},
				},
			],
		}).compile();

		interceptor = module.get<MintKeysetInterceptor>(MintKeysetInterceptor);
		reflector = module.get(Reflector);
		eventLogService = module.get(EventLogService);
		cashuMintDatabaseService = module.get(CashuMintDatabaseService);
		mintService = module.get(MintService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(interceptor).toBeDefined();
	});

	describe('when no @LogEvent metadata', () => {
		it('should pass through without logging', async () => {
			// arrange
			reflector.get.mockReturnValue(undefined);
			const context = createMockContext();
			const handler = createMockCallHandler({});

			// act
			const result = await interceptor.intercept(context, handler);
			await lastValueFrom(result);

			// assert
			expect(handler.handle).toHaveBeenCalled();
			expect(eventLogService.createEvent).not.toHaveBeenCalled();
		});
	});

	describe('successful rotation', () => {
		it('should log TWO events: UPDATE for old keyset and CREATE for new keyset', async () => {
			// arrange
			reflector.get.mockReturnValue(mock_metadata);
			cashuMintDatabaseService.getKeysets.mockResolvedValue([mock_old_keyset, mock_new_keyset] as any);
			const context = createMockContext({unit: 'sat'});
			const handler = createMockCallHandler(mock_rotation_result);

			// act
			const result = await interceptor.intercept(context, handler);
			await lastValueFrom(result);
			await flushPromises();

			// assert — two calls to createEvent
			expect(eventLogService.createEvent).toHaveBeenCalledTimes(2);

			// UPDATE event for old keyset deactivation
			expect(eventLogService.createEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					actor_type: EventLogActorType.USER,
					actor_id: mock_user_id,
					section: EventLogSection.MINT,
					section_id: '1',
					entity_type: EventLogEntityType.KEYSET,
					entity_id: 'old-keyset-001',
					type: EventLogType.UPDATE,
					status: EventLogStatus.SUCCESS,
					details: [
						expect.objectContaining({
							field: 'active',
							old_value: 'true',
							new_value: 'false',
							status: EventLogDetailStatus.SUCCESS,
						}),
					],
				}),
			);

			// CREATE event for new keyset
			expect(eventLogService.createEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					entity_type: EventLogEntityType.KEYSET,
					entity_id: 'new-keyset-002',
					type: EventLogType.CREATE,
					status: EventLogStatus.SUCCESS,
					details: expect.arrayContaining([
						expect.objectContaining({field: 'unit', new_value: 'sat'}),
						expect.objectContaining({field: 'amounts', new_value: JSON.stringify([1, 2, 4, 8, 16])}),
						expect.objectContaining({field: 'input_fee_ppk', new_value: '100'}),
					]),
				}),
			);
		});

		it('should include keyset_v2 detail when provided in args', async () => {
			// arrange
			reflector.get.mockReturnValue(mock_metadata);
			cashuMintDatabaseService.getKeysets.mockResolvedValue([mock_old_keyset, mock_new_keyset] as any);
			const context = createMockContext({unit: 'sat', keyset_v2: true});
			const handler = createMockCallHandler(mock_rotation_result);

			// act
			const result = await interceptor.intercept(context, handler);
			await lastValueFrom(result);
			await flushPromises();

			// assert — CREATE event includes keyset_v2
			const create_call = eventLogService.createEvent.mock.calls.find((call) => call[0].type === EventLogType.CREATE);
			expect(create_call).toBeDefined();
			expect(create_call[0].details).toEqual(
				expect.arrayContaining([expect.objectContaining({field: 'keyset_v2', new_value: 'true'})]),
			);
		});

		it('should omit amounts and input_fee_ppk when null in result', async () => {
			// arrange
			reflector.get.mockReturnValue(mock_metadata);
			cashuMintDatabaseService.getKeysets.mockResolvedValue([mock_old_keyset, mock_new_keyset] as any);
			const context = createMockContext({unit: 'sat'});
			const minimal_result = {id: 'new-keyset-002', unit: 'sat', amounts: null, input_fee_ppk: null};
			const handler = createMockCallHandler(minimal_result);

			// act
			const result = await interceptor.intercept(context, handler);
			await lastValueFrom(result);
			await flushPromises();

			// assert — CREATE event has only unit detail
			const create_call = eventLogService.createEvent.mock.calls.find((call) => call[0].type === EventLogType.CREATE);
			expect(create_call[0].details).toHaveLength(1);
			expect(create_call[0].details[0].field).toBe('unit');
		});

		it('should skip UPDATE event when old keyset not found', async () => {
			// arrange
			reflector.get.mockReturnValue(mock_metadata);
			cashuMintDatabaseService.getKeysets.mockResolvedValue([mock_new_keyset] as any);
			const context = createMockContext({unit: 'sat'});
			const handler = createMockCallHandler(mock_rotation_result);

			// act
			const result = await interceptor.intercept(context, handler);
			await lastValueFrom(result);
			await flushPromises();

			// assert — only CREATE event logged
			expect(eventLogService.createEvent).toHaveBeenCalledTimes(1);
			expect(eventLogService.createEvent).toHaveBeenCalledWith(expect.objectContaining({type: EventLogType.CREATE}));
		});

		it('should handle getKeysets failure gracefully and still log CREATE', async () => {
			// arrange
			reflector.get.mockReturnValue(mock_metadata);
			mintService.withDbClient.mockRejectedValue(new Error('DB error'));
			const context = createMockContext({unit: 'sat'});
			const handler = createMockCallHandler(mock_rotation_result);

			// act
			const result = await interceptor.intercept(context, handler);
			await lastValueFrom(result);
			await flushPromises();

			// assert — only CREATE event (no old keyset to UPDATE)
			expect(eventLogService.createEvent).toHaveBeenCalledTimes(1);
			expect(eventLogService.createEvent).toHaveBeenCalledWith(expect.objectContaining({type: EventLogType.CREATE}));
		});
	});

	describe('error path', () => {
		it('should log single CREATE ERROR event with unit detail', async () => {
			// arrange
			reflector.get.mockReturnValue(mock_metadata);
			const mock_error = {message: 'Rotation failed', extensions: {code: 'KEYSET_ERROR', details: 'Cannot rotate'}};
			const context = createMockContext({unit: 'sat'});
			const handler: CallHandler = {
				handle: jest.fn().mockReturnValue(throwError(() => mock_error)),
			};

			// act
			const result = await interceptor.intercept(context, handler);
			await expect(lastValueFrom(result)).rejects.toEqual(mock_error);

			// assert
			expect(eventLogService.createEvent).toHaveBeenCalledTimes(1);
			expect(eventLogService.createEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					entity_type: EventLogEntityType.KEYSET,
					entity_id: null,
					type: EventLogType.CREATE,
					status: EventLogStatus.ERROR,
					details: [
						expect.objectContaining({
							field: 'unit',
							new_value: 'sat',
							status: EventLogDetailStatus.ERROR,
							error_code: 'KEYSET_ERROR',
							error_message: 'Cannot rotate',
						}),
					],
				}),
			);
		});
	});

	describe('fire-and-forget resilience', () => {
		it('should not break mutation when createEvent fails', async () => {
			// arrange
			reflector.get.mockReturnValue(mock_metadata);
			cashuMintDatabaseService.getKeysets.mockResolvedValue([mock_old_keyset, mock_new_keyset] as any);
			eventLogService.createEvent.mockRejectedValue(new Error('DB write failed'));
			const context = createMockContext({unit: 'sat'});
			const handler = createMockCallHandler(mock_rotation_result);

			// act
			const result = await interceptor.intercept(context, handler);
			const output = await lastValueFrom(result);
			await flushPromises();

			// assert — mutation still returns successfully
			expect(output).toEqual(mock_rotation_result);
		});
	});
});
