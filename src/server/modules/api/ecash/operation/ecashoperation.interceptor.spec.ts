/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {Reflector} from '@nestjs/core';
import type {CallHandler, ExecutionContext} from '@nestjs/common';
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
/* Local Dependencies */
import {EcashOperationInterceptor} from './ecashoperation.interceptor.js';

describe('EcashOperationInterceptor', () => {
	let interceptor: EcashOperationInterceptor;
	let reflector: jest.Mocked<Reflector>;
	let eventLogService: jest.Mocked<EventLogService>;

	const mock_metadata: EventLogMetadata = {type: EventLogType.CREATE, field: 'issue'};
	const mock_args = {unit: 'sat', amount: 2100, memo: 'Meetup prizes'};
	const mock_user_id = 'user-1';

	/** Creates a mock ExecutionContext for a GraphQL resolver call */
	const createMockContext = (args: Record<string, any> = mock_args, user_id: string = mock_user_id): ExecutionContext =>
		({
			getHandler: jest.fn(),
			getClass: jest.fn(),
			getArgs: jest.fn().mockReturnValue([null, args, {req: {user: {id: user_id}}}, null]),
			getType: jest.fn().mockReturnValue('graphql'),
			switchToHttp: jest.fn(),
			switchToRpc: jest.fn(),
			switchToWs: jest.fn(),
			getArgByIndex: jest.fn(),
		}) as unknown as ExecutionContext;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				EcashOperationInterceptor,
				{provide: Reflector, useValue: {get: jest.fn()}},
				{provide: EventLogService, useValue: {logEvent: jest.fn()}},
			],
		}).compile();

		interceptor = module.get<EcashOperationInterceptor>(EcashOperationInterceptor);
		reflector = module.get(Reflector);
		eventLogService = module.get(EventLogService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(interceptor).toBeDefined();
	});

	describe('when no @LogEvent metadata', () => {
		it('should pass through without logging', async () => {
			reflector.get.mockReturnValue(undefined);
			const handler: CallHandler = {handle: jest.fn().mockReturnValue(of({id: 'op-1'}))};
			await lastValueFrom(await interceptor.intercept(createMockContext(), handler));
			expect(eventLogService.logEvent).not.toHaveBeenCalled();
		});
	});

	describe('on successful mutation', () => {
		it('should log the issued operation with its amount, unit and memo', async () => {
			reflector.get.mockReturnValue(mock_metadata);
			const handler: CallHandler = {handle: jest.fn().mockReturnValue(of({id: 'op-1'}))};
			await lastValueFrom(await interceptor.intercept(createMockContext(), handler));
			expect(eventLogService.logEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					actor_type: EventLogActorType.USER,
					actor_id: mock_user_id,
					section: EventLogSection.ECASH,
					entity_type: EventLogEntityType.ECASH,
					entity_id: 'op-1',
					type: EventLogType.CREATE,
					status: EventLogStatus.SUCCESS,
					details: [
						expect.objectContaining({field: 'amount', new_value: '2100', status: EventLogDetailStatus.SUCCESS}),
						expect.objectContaining({field: 'unit', new_value: 'sat'}),
						expect.objectContaining({field: 'memo', new_value: 'Meetup prizes'}),
					],
				}),
			);
		});
	});

	describe('on failed mutation', () => {
		it("should log the refusal with the mint's own message and no operation", async () => {
			reflector.get.mockReturnValue(mock_metadata);
			const error = {extensions: {code: 70001, details: 'Mint quote state override is disabled'}};
			const handler: CallHandler = {handle: jest.fn().mockReturnValue(throwError(() => error))};
			const result = await interceptor.intercept(createMockContext({unit: 'sat', amount: 2100, memo: null}), handler);
			await expect(lastValueFrom(result)).rejects.toEqual(error);
			expect(eventLogService.logEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					entity_id: null,
					status: EventLogStatus.ERROR,
					details: [
						expect.objectContaining({
							field: 'amount',
							status: EventLogDetailStatus.ERROR,
							error_code: '70001',
							error_message: 'Mint quote state override is disabled',
						}),
						expect.objectContaining({field: 'unit'}),
					],
				}),
			);
		});
	});
});
