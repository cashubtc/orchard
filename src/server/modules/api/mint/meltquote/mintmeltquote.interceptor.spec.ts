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
import {CashuMintApiService} from '@server/modules/cashu/mintapi/cashumintapi.service';
import {CashuMintDatabaseService} from '@server/modules/cashu/mintdb/cashumintdb.service';
import {MintService} from '@server/modules/api/mint/mint.service';
/* Local Dependencies */
import {MintMeltQuoteInterceptor} from './mintmeltquote.interceptor.js';

/**
 * Test suite for MintMeltQuoteInterceptor
 * Tests event logging for NUT-05 method config updates and melt quote state changes
 */
describe('MintMeltQuoteInterceptor', () => {
	let interceptor: MintMeltQuoteInterceptor;
	let reflector: jest.Mocked<Reflector>;
	let eventLogService: jest.Mocked<EventLogService>;
	let cashuMintApiService: jest.Mocked<CashuMintApiService>;
	let cashuMintDatabaseService: jest.Mocked<CashuMintDatabaseService>;
	let mintService: jest.Mocked<MintService>;

	const mock_user_id = 'user-123';

	const mock_mint_info = {
		nuts: {
			5: {
				disabled: false,
				methods: [{unit: 'sat', method: 'bolt11', min_amount: 1, max_amount: 100000}],
			},
		},
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
				MintMeltQuoteInterceptor,
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
					provide: CashuMintApiService,
					useValue: {getMintInfo: jest.fn()},
				},
				{
					provide: CashuMintDatabaseService,
					useValue: {lookupMeltQuote: jest.fn()},
				},
				{
					provide: MintService,
					useValue: {
						withDbClient: jest.fn().mockImplementation((fn) => fn('mock-client')),
					},
				},
			],
		}).compile();

		interceptor = module.get<MintMeltQuoteInterceptor>(MintMeltQuoteInterceptor);
		reflector = module.get(Reflector);
		eventLogService = module.get(EventLogService);
		cashuMintApiService = module.get(CashuMintApiService);
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

	describe('NUT05 route (field=nut05)', () => {
		const nut05_metadata: EventLogMetadata = {
			type: EventLogType.UPDATE,
			field: 'nut05',
		};

		it('should log NUT05 update with correct entity type and composite entity_id', async () => {
			// arrange
			reflector.get.mockReturnValue(nut05_metadata);
			cashuMintApiService.getMintInfo.mockResolvedValue(mock_mint_info as any);
			const context = createMockContext({unit: 'sat', method: 'bolt11', disabled: true, min_amount: 10, max_amount: 50000});
			const handler = createMockCallHandler({});

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
					entity_type: EventLogEntityType.NUT05,
					entity_id: 'sat:bolt11',
					type: EventLogType.UPDATE,
					status: EventLogStatus.SUCCESS,
					details: expect.arrayContaining([
						expect.objectContaining({
							field: 'disabled',
							old_value: 'false',
							new_value: 'true',
							status: EventLogDetailStatus.SUCCESS,
						}),
						expect.objectContaining({
							field: 'min_amount',
							old_value: '1',
							new_value: '10',
							status: EventLogDetailStatus.SUCCESS,
						}),
						expect.objectContaining({
							field: 'max_amount',
							old_value: '100000',
							new_value: '50000',
							status: EventLogDetailStatus.SUCCESS,
						}),
					]),
				}),
			);
		});

		it('should skip null/undefined fields in details', async () => {
			// arrange
			reflector.get.mockReturnValue(nut05_metadata);
			cashuMintApiService.getMintInfo.mockResolvedValue(mock_mint_info as any);
			const context = createMockContext({unit: 'sat', method: 'bolt11', disabled: true});
			const handler = createMockCallHandler({});

			// act
			const result = await interceptor.intercept(context, handler);
			await lastValueFrom(result);

			// assert
			const call_args = eventLogService.createEvent.mock.calls[0][0];
			expect(call_args.details).toHaveLength(1);
			expect(call_args.details[0].field).toBe('disabled');
		});

		it('should handle missing nut05 config gracefully', async () => {
			// arrange
			reflector.get.mockReturnValue(nut05_metadata);
			cashuMintApiService.getMintInfo.mockResolvedValue({nuts: {}} as any);
			const context = createMockContext({unit: 'sat', method: 'bolt11', min_amount: 10});
			const handler = createMockCallHandler({});

			// act
			const result = await interceptor.intercept(context, handler);
			await lastValueFrom(result);

			// assert
			expect(eventLogService.createEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					details: [expect.objectContaining({field: 'min_amount', old_value: null, new_value: '10'})],
				}),
			);
		});

		it('should handle getMintInfo failure gracefully', async () => {
			// arrange
			reflector.get.mockReturnValue(nut05_metadata);
			cashuMintApiService.getMintInfo.mockRejectedValue(new Error('API error'));
			const context = createMockContext({unit: 'sat', method: 'bolt11', disabled: false});
			const handler = createMockCallHandler({});

			// act
			const result = await interceptor.intercept(context, handler);
			await lastValueFrom(result);

			// assert
			expect(eventLogService.createEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					details: [expect.objectContaining({field: 'disabled', old_value: null, new_value: 'false'})],
				}),
			);
		});
	});

	describe('quote state route (field=nut05_quote)', () => {
		const quote_metadata: EventLogMetadata = {
			type: EventLogType.UPDATE,
			field: 'nut05_quote',
		};

		it('should log quote state change with correct entity type and id', async () => {
			// arrange
			reflector.get.mockReturnValue(quote_metadata);
			cashuMintDatabaseService.lookupMeltQuote.mockResolvedValue({state: 'UNPAID'} as any);
			const context = createMockContext({quote_id: 'quote-456', state: 'PAID'});
			const handler = createMockCallHandler({});

			// act
			const result = await interceptor.intercept(context, handler);
			await lastValueFrom(result);

			// assert
			expect(mintService.withDbClient).toHaveBeenCalled();
			expect(eventLogService.createEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					entity_type: EventLogEntityType.QUOTE,
					entity_id: 'quote-456',
					details: [
						expect.objectContaining({
							field: 'state',
							old_value: 'UNPAID',
							new_value: 'PAID',
							status: EventLogDetailStatus.SUCCESS,
						}),
					],
				}),
			);
		});

		it('should handle null old state when fetch fails', async () => {
			// arrange
			reflector.get.mockReturnValue(quote_metadata);
			mintService.withDbClient.mockRejectedValue(new Error('DB error'));
			const context = createMockContext({quote_id: 'quote-456', state: 'PAID'});
			const handler = createMockCallHandler({});

			// act
			const result = await interceptor.intercept(context, handler);
			await lastValueFrom(result);

			// assert
			expect(eventLogService.createEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					details: [expect.objectContaining({old_value: null, new_value: 'PAID'})],
				}),
			);
		});
	});

	describe('error path', () => {
		it('should map all details to ERROR status with error info', async () => {
			// arrange
			const nut05_metadata: EventLogMetadata = {type: EventLogType.UPDATE, field: 'nut05'};
			reflector.get.mockReturnValue(nut05_metadata);
			cashuMintApiService.getMintInfo.mockResolvedValue(mock_mint_info as any);
			const mock_error = {message: 'RPC failed', extensions: {code: 'NUT05_ERROR', details: 'Method not found'}};
			const context = createMockContext({unit: 'sat', method: 'bolt11', disabled: true});
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
					details: [
						expect.objectContaining({
							status: EventLogDetailStatus.ERROR,
							error_code: 'NUT05_ERROR',
							error_message: 'Method not found',
						}),
					],
				}),
			);
		});
	});

	describe('fire-and-forget resilience', () => {
		it('should not break mutation when createEvent fails', async () => {
			// arrange
			const nut05_metadata: EventLogMetadata = {type: EventLogType.UPDATE, field: 'nut05'};
			reflector.get.mockReturnValue(nut05_metadata);
			cashuMintApiService.getMintInfo.mockResolvedValue(mock_mint_info as any);
			eventLogService.createEvent.mockRejectedValue(new Error('DB write failed'));
			const expected_result = {success: true};
			const context = createMockContext({unit: 'sat', method: 'bolt11', disabled: true});
			const handler = createMockCallHandler(expected_result);

			// act
			const result = await interceptor.intercept(context, handler);
			const output = await lastValueFrom(result);

			// assert
			expect(output).toEqual(expected_result);
		});
	});
});
