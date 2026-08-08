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
import {SettingService} from '#server/modules/setting/setting.service';
import {SettingKey, SettingValue} from '#server/modules/setting/setting.enums';
/* Local Dependencies */
import {SettingInterceptor} from './setting.interceptor.js';

/**
 * Test suite for SettingInterceptor
 * Tests event logging for setting mutations
 */
describe('SettingInterceptor', () => {
	let interceptor: SettingInterceptor;
	let reflector: jest.Mocked<Reflector>;
	let eventLogService: jest.Mocked<EventLogService>;
	let settingService: jest.Mocked<SettingService>;

	const mock_metadata: EventLogMetadata = {
		type: EventLogType.UPDATE,
		field: 'setting',
		arg_keys: ['value'],
		old_value_key: 'value',
	};

	const mock_user_id = 'user-123';

	/** Creates a mock ExecutionContext for GraphQL resolvers */
	const createMockContext = (args: Record<string, any> = {}, user_id: string = mock_user_id): ExecutionContext => {
		const mock_context = {
			getHandler: jest.fn(),
			getClass: jest.fn(),
			getArgs: jest.fn().mockReturnValue([null, args, {req: {user: {id: user_id}}}, null]),
			getType: jest.fn().mockReturnValue('graphql'),
			switchToHttp: jest.fn(),
			switchToRpc: jest.fn(),
			switchToWs: jest.fn(),
			getArgByIndex: jest.fn(),
		} as unknown as ExecutionContext;
		return mock_context;
	};

	const createMockCallHandler = (result: any = {}): CallHandler => ({
		handle: jest.fn().mockReturnValue(of(result)),
	});

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				SettingInterceptor,
				{
					provide: Reflector,
					useValue: {
						get: jest.fn(),
					},
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
					provide: SettingService,
					useValue: {
						getSetting: jest.fn(),
					},
				},
			],
		}).compile();

		interceptor = module.get<SettingInterceptor>(SettingInterceptor);
		reflector = module.get(Reflector);
		eventLogService = module.get(EventLogService);
		settingService = module.get(SettingService);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	/**
	 * Test interceptor instantiation
	 */
	it('should be defined', () => {
		expect(interceptor).toBeDefined();
	});

	/**
	 * Test pass-through when no metadata
	 */
	describe('when no @LogEvent metadata', () => {
		it('should pass through without logging', async () => {
			// arrange
			reflector.get.mockReturnValue(undefined);
			const context = createMockContext();
			const handler = createMockCallHandler({value: 'true'});

			// act
			const result = await interceptor.intercept(context, handler);
			await lastValueFrom(result);

			// assert
			expect(handler.handle).toHaveBeenCalled();
			expect(eventLogService.createEvent).not.toHaveBeenCalled();
		});
	});

	/**
	 * Test successful setting update logging
	 */
	describe('on successful mutation', () => {
		it('should log a SUCCESS event with old and new values', async () => {
			// arrange
			reflector.get.mockReturnValue(mock_metadata);
			settingService.getSetting.mockResolvedValue({
				key: SettingKey.BITCOIN_ORACLE,
				value: 'false',
				value_type: SettingValue.BOOLEAN,
				description: 'Whether the bitcoin oracle is enabled',
			} as any);

			const context = createMockContext({keys: [SettingKey.BITCOIN_ORACLE], values: ['true']});
			const handler = createMockCallHandler({key: SettingKey.BITCOIN_ORACLE, value: 'true'});

			// act
			const result = await interceptor.intercept(context, handler);
			await lastValueFrom(result);

			// assert
			expect(settingService.getSetting).toHaveBeenCalledWith(SettingKey.BITCOIN_ORACLE);
			expect(eventLogService.createEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					actor_type: EventLogActorType.USER,
					actor_id: mock_user_id,
					section: EventLogSection.SETTINGS,
					entity_type: EventLogEntityType.SETTING,
					entity_id: SettingKey.BITCOIN_ORACLE,
					type: EventLogType.UPDATE,
					status: EventLogStatus.SUCCESS,
					details: [
						expect.objectContaining({
							field: SettingKey.BITCOIN_ORACLE,
							old_value: 'false',
							new_value: 'true',
							status: EventLogDetailStatus.SUCCESS,
							error_code: null,
							error_message: null,
						}),
					],
				}),
			);
		});
	});

	/**
	 * Test error event logging
	 */
	describe('on failed mutation', () => {
		it('should log an ERROR event with error details', async () => {
			// arrange
			reflector.get.mockReturnValue(mock_metadata);
			settingService.getSetting.mockResolvedValue({
				key: SettingKey.BITCOIN_ORACLE,
				value: 'false',
				value_type: SettingValue.BOOLEAN,
				description: 'Whether the bitcoin oracle is enabled',
			} as any);

			const mock_error = {message: 'Update failed', extensions: {code: 'SETTING_ERROR', details: 'Invalid value'}};
			const context = createMockContext({keys: [SettingKey.BITCOIN_ORACLE], values: ['invalid']});
			const handler: CallHandler = {
				handle: jest.fn().mockReturnValue(throwError(() => mock_error)),
			};

			// act & assert
			const result = await interceptor.intercept(context, handler);
			await expect(lastValueFrom(result)).rejects.toEqual(mock_error);

			expect(eventLogService.createEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					status: EventLogStatus.ERROR,
					details: [
						expect.objectContaining({
							field: SettingKey.BITCOIN_ORACLE,
							old_value: 'false',
							new_value: 'invalid',
							status: EventLogDetailStatus.ERROR,
							error_code: 'SETTING_ERROR',
							error_message: 'Invalid value',
						}),
					],
				}),
			);
		});
	});

	/**
	 * Test resilience when fetching old value fails
	 */
	describe('when fetching old value fails', () => {
		it('should still proceed with null old_value', async () => {
			// arrange
			reflector.get.mockReturnValue(mock_metadata);
			settingService.getSetting.mockRejectedValue(new Error('DB error'));

			const context = createMockContext({keys: [SettingKey.BITCOIN_ORACLE], values: ['true']});
			const handler = createMockCallHandler({});

			// act
			const result = await interceptor.intercept(context, handler);
			await lastValueFrom(result);

			// assert
			expect(eventLogService.createEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					details: [
						expect.objectContaining({
							old_value: null,
							new_value: 'true',
						}),
					],
				}),
			);
		});
	});

	/**
	 * Test sensitive value redaction in event logs
	 */
	describe('sensitive value redaction', () => {
		it('should mask sensitive values in event log', async () => {
			// arrange
			reflector.get.mockReturnValue(mock_metadata);
			settingService.getSetting.mockResolvedValue({
				key: SettingKey.AI_OPENROUTER_KEY,
				value: 'sk-or-v1-old-secret',
				value_type: SettingValue.STRING,
				description: 'The OpenRouter API key',
			} as any);

			const context = createMockContext({keys: [SettingKey.AI_OPENROUTER_KEY], values: ['sk-or-v1-new-secret']});
			const handler = createMockCallHandler({key: SettingKey.AI_OPENROUTER_KEY, value: 'sk-or-v1-new-secret'});

			// act
			const result = await interceptor.intercept(context, handler);
			await lastValueFrom(result);

			// assert
			expect(eventLogService.createEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					details: [
						expect.objectContaining({
							field: SettingKey.AI_OPENROUTER_KEY,
							old_value: '\u2022\u2022\u2022\u2022cret',
							new_value: '\u2022\u2022\u2022\u2022cret',
							status: EventLogDetailStatus.SUCCESS,
						}),
					],
				}),
			);
		});

		it('should not mask non-sensitive values in event log', async () => {
			// arrange
			reflector.get.mockReturnValue(mock_metadata);
			settingService.getSetting.mockResolvedValue({
				key: SettingKey.BITCOIN_ORACLE,
				value: 'false',
				value_type: SettingValue.BOOLEAN,
				description: 'Whether the bitcoin oracle is enabled',
			} as any);

			const context = createMockContext({keys: [SettingKey.BITCOIN_ORACLE], values: ['true']});
			const handler = createMockCallHandler({key: SettingKey.BITCOIN_ORACLE, value: 'true'});

			// act
			const result = await interceptor.intercept(context, handler);
			await lastValueFrom(result);

			// assert
			expect(eventLogService.createEvent).toHaveBeenCalledWith(
				expect.objectContaining({
					details: [
						expect.objectContaining({
							old_value: 'false',
							new_value: 'true',
						}),
					],
				}),
			);
		});
	});

	/**
	 * Test fire-and-forget: event log failures don't break the mutation
	 */
	describe('when event logging fails', () => {
		it('should not break the mutation response', async () => {
			// arrange
			reflector.get.mockReturnValue(mock_metadata);
			settingService.getSetting.mockResolvedValue({
				key: SettingKey.BITCOIN_ORACLE,
				value: 'false',
				value_type: SettingValue.BOOLEAN,
				description: null,
			} as any);
			eventLogService.createEvent.mockRejectedValue(new Error('Logging failed'));

			const context = createMockContext({keys: [SettingKey.BITCOIN_ORACLE], values: ['true']});
			const expected_result = {key: SettingKey.BITCOIN_ORACLE, value: 'true'};
			const handler = createMockCallHandler(expected_result);

			// act
			const result = await interceptor.intercept(context, handler);
			const output = await lastValueFrom(result);

			// assert — mutation still returns successfully
			expect(output).toEqual(expected_result);
		});
	});
});
