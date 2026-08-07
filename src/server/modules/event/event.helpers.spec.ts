/* Core Dependencies */
import {ExecutionContext} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {EventLogMetadata} from '@server/modules/event/event.decorator';
import {EventLogActorType} from '@server/modules/event/event.enums';
import {UserRole} from '@server/modules/user/user.enums';
/* Local Dependencies */
import {getActorType, extractEventContext, extractEventError, eventTimestamp} from './event.helpers.js';

/**
 * Test suite for event helper utilities
 */
describe('Event Helpers', () => {
	/* *******************************************************
		getActorType
	******************************************************** */

	describe('getActorType', () => {
		it('should return AGENT when user role is AGENT', () => {
			expect(getActorType({role: UserRole.AGENT})).toBe(EventLogActorType.AGENT);
		});

		it('should return USER when user role is ADMIN', () => {
			expect(getActorType({role: UserRole.ADMIN})).toBe(EventLogActorType.USER);
		});

		it('should return USER when user role is MANAGER', () => {
			expect(getActorType({role: UserRole.MANAGER})).toBe(EventLogActorType.USER);
		});

		it('should return USER when user is undefined', () => {
			expect(getActorType(undefined)).toBe(EventLogActorType.USER);
		});

		it('should return USER when role is undefined', () => {
			expect(getActorType({})).toBe(EventLogActorType.USER);
		});
	});

	/* *******************************************************
		extractEventContext
	******************************************************** */

	describe('extractEventContext', () => {
		const mock_metadata: EventLogMetadata = {type: 'update' as any, field: 'name'};

		const createMockContext = (args: Record<string, any> = {}, user?: {id: string; role?: string}): ExecutionContext => {
			return {
				getHandler: jest.fn(),
				getClass: jest.fn(),
				getArgs: jest.fn().mockReturnValue([null, args, {req: {user}}, null]),
				getType: jest.fn().mockReturnValue('graphql'),
				switchToHttp: jest.fn(),
				switchToRpc: jest.fn(),
				switchToWs: jest.fn(),
				getArgByIndex: jest.fn(),
			} as unknown as ExecutionContext;
		};

		it('should return null when no metadata is present', () => {
			const reflector = {get: jest.fn().mockReturnValue(undefined)} as unknown as Reflector;
			const context = createMockContext();

			expect(extractEventContext(context, reflector)).toBeNull();
		});

		it('should extract context with correct actor_id and actor_type', () => {
			const reflector = {get: jest.fn().mockReturnValue(mock_metadata)} as unknown as Reflector;
			const context = createMockContext({name: 'test'}, {id: 'user-123', role: UserRole.ADMIN});

			const result = extractEventContext(context, reflector);

			expect(result).toEqual({
				metadata: mock_metadata,
				args: {name: 'test'},
				actor_id: 'user-123',
				actor_type: EventLogActorType.USER,
			});
		});

		it('should return actor_type AGENT when user role is AGENT', () => {
			const reflector = {get: jest.fn().mockReturnValue(mock_metadata)} as unknown as Reflector;
			const context = createMockContext({}, {id: 'agent-1', role: UserRole.AGENT});

			const result = extractEventContext(context, reflector);

			expect(result?.actor_type).toBe(EventLogActorType.AGENT);
			expect(result?.actor_id).toBe('agent-1');
		});

		it('should default actor_id to unknown when no user', () => {
			const reflector = {get: jest.fn().mockReturnValue(mock_metadata)} as unknown as Reflector;
			const context = createMockContext();

			const result = extractEventContext(context, reflector);

			expect(result?.actor_id).toBe('unknown');
			expect(result?.actor_type).toBe(EventLogActorType.USER);
		});
	});

	/* *******************************************************
		extractEventError
	******************************************************** */

	describe('extractEventError', () => {
		it('should extract error_code and error_message from extensions', () => {
			const error = {extensions: {code: 'MINT_ERROR', details: 'Name too long'}, message: 'fallback'};

			expect(extractEventError(error)).toEqual({
				error_code: 'MINT_ERROR',
				error_message: 'Name too long',
			});
		});

		it('should fall back to message when no extensions.details', () => {
			const error = {message: 'Something failed'};

			expect(extractEventError(error)).toEqual({
				error_code: null,
				error_message: 'Something failed',
			});
		});

		it('should return nulls for empty error', () => {
			expect(extractEventError({})).toEqual({
				error_code: null,
				error_message: null,
			});
		});

		it('should return nulls for undefined error', () => {
			expect(extractEventError(undefined)).toEqual({
				error_code: null,
				error_message: null,
			});
		});
	});

	/* *******************************************************
		eventTimestamp
	******************************************************** */

	describe('eventTimestamp', () => {
		it('should return a number', () => {
			expect(typeof eventTimestamp()).toBe('number');
		});

		it('should return current time in seconds within tolerance', () => {
			const now = Math.floor(Date.now() / 1000);
			const result = eventTimestamp();

			expect(result).toBeGreaterThanOrEqual(now - 1);
			expect(result).toBeLessThanOrEqual(now + 1);
		});
	});
});
