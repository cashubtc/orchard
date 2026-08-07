/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {Reflector} from '@nestjs/core';
import {CallHandler, ExecutionContext} from '@nestjs/common';
import {expect} from '@jest/globals';
/* Vendor Dependencies */
import {of, throwError, lastValueFrom} from 'rxjs';
/* Application Dependencies */
import {EventLogService} from '#server/modules/event/event.service';
import {EventLogMetadata} from '#server/modules/event/event.decorator';
import {
	EventLogActorType,
	EventLogSection,
	EventLogEntityType,
	EventLogType,
	EventLogStatus,
	EventLogDetailStatus,
} from '#server/modules/event/event.enums';
import {CashuMintRpcService} from '#server/modules/cashu/mintrpc/cashumintrpc.service';
/* Local Dependencies */
import {MintInfoInterceptor} from './mintinfo.interceptor.js';

/**
 * Test suite for MintInfoInterceptor
 * Tests event logging for mint info mutations (name, icon, description, motd, urls, contacts)
 */
describe('MintInfoInterceptor', () => {
	let interceptor: MintInfoInterceptor;
	let reflector: jest.Mocked<Reflector>;
	let eventLogService: jest.Mocked<EventLogService>;
	let cashuMintRpcService: jest.Mocked<CashuMintRpcService>;

	const mock_user_id = 'user-123';

	const mock_mint_info = {
		name: 'Old Mint Name',
		icon_url: 'https://old-icon.png',
		description: 'Old short description',
		description_long: 'Old long description',
		motd: 'Old message of the day',
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
				MintInfoInterceptor,
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
					useValue: {getMintInfo: jest.fn()},
				},
			],
		}).compile();

		interceptor = module.get<MintInfoInterceptor>(MintInfoInterceptor);
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
			const handler = createMockCallHandler({name: 'Test'});

			// act
			const result = await interceptor.intercept(context, handler);
			await lastValueFrom(result);

			// assert
			expect(handler.handle).toHaveBeenCalled();
			expect(eventLogService.createEvent).not.toHaveBeenCalled();
		});
	});

	describe('UPDATE path', () => {
		const update_metadata: EventLogMetadata = {
			type: EventLogType.UPDATE,
			field: 'name',
			arg_keys: ['name'],
			old_value_key: 'name',
		};

		it('should log SUCCESS with old and new values', async () => {
			// arrange
			reflector.get.mockReturnValue(update_metadata);
			cashuMintRpcService.getMintInfo.mockResolvedValue(mock_mint_info as any);
			const context = createMockContext({name: 'New Mint Name'});
			const handler = createMockCallHandler({name: 'New Mint Name'});

			// act
			const result = await interceptor.intercept(context, handler);
			await lastValueFrom(result);

			// assert
			expect(cashuMintRpcService.getMintInfo).toHaveBeenCalled();
			expect(eventLogService.createEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					actor_type: EventLogActorType.USER,
					actor_id: mock_user_id,
					section: EventLogSection.MINT,
					section_id: '1',
					entity_type: EventLogEntityType.INFO,
					entity_id: null,
					type: EventLogType.UPDATE,
					status: EventLogStatus.SUCCESS,
					details: [
						expect.objectContaining({
							field: 'name',
							old_value: 'Old Mint Name',
							new_value: 'New Mint Name',
							status: EventLogDetailStatus.SUCCESS,
						}),
					],
				}),
			);
		});

		it('should handle null old value when getMintInfo fails', async () => {
			// arrange
			reflector.get.mockReturnValue(update_metadata);
			cashuMintRpcService.getMintInfo.mockRejectedValue(new Error('RPC error'));
			const context = createMockContext({name: 'New Name'});
			const handler = createMockCallHandler({name: 'New Name'});

			// act
			const result = await interceptor.intercept(context, handler);
			await lastValueFrom(result);

			// assert
			expect(eventLogService.createEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					details: [
						expect.objectContaining({
							old_value: null,
							new_value: 'New Name',
						}),
					],
				}),
			);
		});
	});

	describe('CREATE path', () => {
		const create_metadata: EventLogMetadata = {
			type: EventLogType.CREATE,
			field: 'url',
			arg_keys: ['url'],
		};

		it('should log with new_value only and null old_value', async () => {
			// arrange
			reflector.get.mockReturnValue(create_metadata);
			const context = createMockContext({url: 'https://example.com'});
			const handler = createMockCallHandler({url: 'https://example.com'});

			// act
			const result = await interceptor.intercept(context, handler);
			await lastValueFrom(result);

			// assert
			expect(cashuMintRpcService.getMintInfo).not.toHaveBeenCalled();
			expect(eventLogService.createEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					type: EventLogType.CREATE,
					details: [
						expect.objectContaining({
							field: 'url',
							old_value: null,
							new_value: 'https://example.com',
						}),
					],
				}),
			);
		});
	});

	describe('DELETE path', () => {
		const delete_metadata: EventLogMetadata = {
			type: EventLogType.DELETE,
			field: 'url',
			arg_keys: ['url'],
		};

		it('should use arg value as old_value and null new_value', async () => {
			// arrange
			reflector.get.mockReturnValue(delete_metadata);
			const context = createMockContext({url: 'https://removed.com'});
			const handler = createMockCallHandler({});

			// act
			const result = await interceptor.intercept(context, handler);
			await lastValueFrom(result);

			// assert
			expect(eventLogService.createEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					type: EventLogType.DELETE,
					details: [
						expect.objectContaining({
							field: 'url',
							old_value: 'https://removed.com',
							new_value: null,
						}),
					],
				}),
			);
		});
	});

	describe('multi-key arg_keys', () => {
		const contact_metadata: EventLogMetadata = {
			type: EventLogType.CREATE,
			field: 'contact',
			arg_keys: ['method', 'info'],
		};

		it('should JSON.stringify composite args', async () => {
			// arrange
			reflector.get.mockReturnValue(contact_metadata);
			const context = createMockContext({method: 'email', info: 'admin@mint.com'});
			const handler = createMockCallHandler({});

			// act
			const result = await interceptor.intercept(context, handler);
			await lastValueFrom(result);

			// assert
			expect(eventLogService.createEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					details: [
						expect.objectContaining({
							new_value: JSON.stringify({method: 'email', info: 'admin@mint.com'}),
						}),
					],
				}),
			);
		});
	});

	describe('error path', () => {
		const update_metadata: EventLogMetadata = {
			type: EventLogType.UPDATE,
			field: 'name',
			arg_keys: ['name'],
			old_value_key: 'name',
		};

		it('should log ERROR with error details', async () => {
			// arrange
			reflector.get.mockReturnValue(update_metadata);
			cashuMintRpcService.getMintInfo.mockResolvedValue(mock_mint_info as any);
			const mock_error = {message: 'RPC failed', extensions: {code: 'MINT_ERROR', details: 'Name too long'}};
			const context = createMockContext({name: 'Bad Name'});
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
							error_code: 'MINT_ERROR',
							error_message: 'Name too long',
						}),
					],
				}),
			);
		});
	});

	describe('fire-and-forget resilience', () => {
		it('should not break mutation when createEvent fails', async () => {
			// arrange
			const metadata: EventLogMetadata = {type: EventLogType.UPDATE, field: 'name', arg_keys: ['name'], old_value_key: 'name'};
			reflector.get.mockReturnValue(metadata);
			cashuMintRpcService.getMintInfo.mockResolvedValue(mock_mint_info as any);
			eventLogService.createEvent.mockRejectedValue(new Error('DB write failed'));
			const expected_result = {name: 'New Name'};
			const context = createMockContext({name: 'New Name'});
			const handler = createMockCallHandler(expected_result);

			// act
			const result = await interceptor.intercept(context, handler);
			const output = await lastValueFrom(result);

			// assert
			expect(output).toEqual(expected_result);
		});
	});
});
