/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {Reflector} from '@nestjs/core';
import {CallHandler, ExecutionContext} from '@nestjs/common';
import {expect} from '@jest/globals';
/* Vendor Dependencies */
import {of, throwError, lastValueFrom} from 'rxjs';
/* Application Dependencies */
import {EventLogService} from '@server/modules/event/event.service';
import {EventLogMetadata} from '@server/modules/event/event.decorator';
import {
	EventLogActorType,
	EventLogSection,
	EventLogEntityType,
	EventLogType,
	EventLogStatus,
	EventLogDetailStatus,
} from '@server/modules/event/event.enums';
import {CashuMintRpcService} from '@server/modules/cashu/mintrpc/cashumintrpc.service';
/* Local Dependencies */
import {MintQuoteInterceptor} from './mintquote.interceptor.js';

/**
 * Test suite for MintQuoteInterceptor
 * Tests event logging for quote TTL updates
 */
describe('MintQuoteInterceptor', () => {
	let interceptor: MintQuoteInterceptor;
	let reflector: jest.Mocked<Reflector>;
	let eventLogService: jest.Mocked<EventLogService>;
	let cashuMintRpcService: jest.Mocked<CashuMintRpcService>;

	const mock_user_id = 'user-123';

	const mock_metadata: EventLogMetadata = {
		type: EventLogType.UPDATE,
		field: 'quote_ttl',
	};

	const mock_old_ttls = {
		mint_ttl: 3600,
		melt_ttl: 7200,
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
				MintQuoteInterceptor,
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
					provide: CashuMintRpcService,
					useValue: {getQuoteTtl: jest.fn()},
				},
			],
		}).compile();

		interceptor = module.get<MintQuoteInterceptor>(MintQuoteInterceptor);
		reflector = module.get(Reflector);
		eventLogService = module.get(EventLogService);
		cashuMintRpcService = module.get(CashuMintRpcService);
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

	describe('on successful mutation', () => {
		it('should log both mint_ttl and melt_ttl when both provided', async () => {
			// arrange
			reflector.get.mockReturnValue(mock_metadata);
			cashuMintRpcService.getQuoteTtl.mockResolvedValue(mock_old_ttls as any);
			const context = createMockContext({mint_quote_ttl_update: {mint_ttl: 1800, melt_ttl: 3600}});
			const handler = createMockCallHandler({mint_ttl: 1800, melt_ttl: 3600});

			// act
			const result = await interceptor.intercept(context, handler);
			await lastValueFrom(result);

			// assert
			expect(eventLogService.createEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					actor_type: EventLogActorType.USER,
					actor_id: mock_user_id,
					section: EventLogSection.MINT,
					section_id: '1',
					entity_type: EventLogEntityType.QUOTE_TTL,
					entity_id: null,
					type: EventLogType.UPDATE,
					status: EventLogStatus.SUCCESS,
					details: expect.arrayContaining([
						expect.objectContaining({
							field: 'mint_ttl',
							old_value: '3600',
							new_value: '1800',
							status: EventLogDetailStatus.SUCCESS,
						}),
						expect.objectContaining({
							field: 'melt_ttl',
							old_value: '7200',
							new_value: '3600',
							status: EventLogDetailStatus.SUCCESS,
						}),
					]),
				}),
			);
		});

		it('should log only mint_ttl when melt_ttl is null', async () => {
			// arrange
			reflector.get.mockReturnValue(mock_metadata);
			cashuMintRpcService.getQuoteTtl.mockResolvedValue(mock_old_ttls as any);
			const context = createMockContext({mint_quote_ttl_update: {mint_ttl: 1800, melt_ttl: null}});
			const handler = createMockCallHandler({});

			// act
			const result = await interceptor.intercept(context, handler);
			await lastValueFrom(result);

			// assert
			const call_args = eventLogService.createEvent.mock.calls[0][0];
			expect(call_args.details).toHaveLength(1);
			expect(call_args.details[0].field).toBe('mint_ttl');
		});

		it('should log only melt_ttl when mint_ttl is undefined', async () => {
			// arrange
			reflector.get.mockReturnValue(mock_metadata);
			cashuMintRpcService.getQuoteTtl.mockResolvedValue(mock_old_ttls as any);
			const context = createMockContext({mint_quote_ttl_update: {melt_ttl: 5000}});
			const handler = createMockCallHandler({});

			// act
			const result = await interceptor.intercept(context, handler);
			await lastValueFrom(result);

			// assert
			const call_args = eventLogService.createEvent.mock.calls[0][0];
			expect(call_args.details).toHaveLength(1);
			expect(call_args.details[0].field).toBe('melt_ttl');
		});

		it('should not log when both fields are null', async () => {
			// arrange
			reflector.get.mockReturnValue(mock_metadata);
			cashuMintRpcService.getQuoteTtl.mockResolvedValue(mock_old_ttls as any);
			const context = createMockContext({mint_quote_ttl_update: {mint_ttl: null, melt_ttl: null}});
			const handler = createMockCallHandler({});

			// act
			const result = await interceptor.intercept(context, handler);
			await lastValueFrom(result);

			// assert
			expect(eventLogService.createEvent).not.toHaveBeenCalled();
		});
	});

	describe('old value resilience', () => {
		it('should use null old values when getQuoteTtl fails', async () => {
			// arrange
			reflector.get.mockReturnValue(mock_metadata);
			cashuMintRpcService.getQuoteTtl.mockRejectedValue(new Error('RPC error'));
			const context = createMockContext({mint_quote_ttl_update: {mint_ttl: 1800}});
			const handler = createMockCallHandler({});

			// act
			const result = await interceptor.intercept(context, handler);
			await lastValueFrom(result);

			// assert
			expect(eventLogService.createEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					details: [expect.objectContaining({field: 'mint_ttl', old_value: null, new_value: '1800'})],
				}),
			);
		});
	});

	describe('error path', () => {
		it('should map all details to ERROR status', async () => {
			// arrange
			reflector.get.mockReturnValue(mock_metadata);
			cashuMintRpcService.getQuoteTtl.mockResolvedValue(mock_old_ttls as any);
			const mock_error = {message: 'Update failed', extensions: {code: 'TTL_ERROR', details: 'Invalid TTL'}};
			const context = createMockContext({mint_quote_ttl_update: {mint_ttl: -1, melt_ttl: -1}});
			const handler: CallHandler = {
				handle: jest.fn().mockReturnValue(throwError(() => mock_error)),
			};

			// act
			const result = await interceptor.intercept(context, handler);
			await expect(lastValueFrom(result)).rejects.toEqual(mock_error);

			// assert
			expect(eventLogService.createEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					status: EventLogStatus.ERROR,
					details: expect.arrayContaining([
						expect.objectContaining({field: 'mint_ttl', status: EventLogDetailStatus.ERROR, error_code: 'TTL_ERROR'}),
						expect.objectContaining({field: 'melt_ttl', status: EventLogDetailStatus.ERROR, error_code: 'TTL_ERROR'}),
					]),
				}),
			);
		});
	});

	describe('fire-and-forget resilience', () => {
		it('should not break mutation when createEvent fails', async () => {
			// arrange
			reflector.get.mockReturnValue(mock_metadata);
			cashuMintRpcService.getQuoteTtl.mockResolvedValue(mock_old_ttls as any);
			eventLogService.createEvent.mockRejectedValue(new Error('DB write failed'));
			const expected_result = {mint_ttl: 1800, melt_ttl: 3600};
			const context = createMockContext({mint_quote_ttl_update: {mint_ttl: 1800, melt_ttl: 3600}});
			const handler = createMockCallHandler(expected_result);

			// act
			const result = await interceptor.intercept(context, handler);
			const output = await lastValueFrom(result);

			// assert
			expect(output).toEqual(expected_result);
		});
	});
});
