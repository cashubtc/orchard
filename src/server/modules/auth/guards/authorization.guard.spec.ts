/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {ExecutionContext} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
import {UserRole} from '@server/modules/user/user.enums';
/* Local Dependencies */
import {GqlAuthorizationGuard} from './authorization.guard.js';

/** Creates a mock GQL execution context with the given request */
function createMockContext(req: any): ExecutionContext {
	return {
		getHandler: jest.fn(),
		getClass: jest.fn(),
		getType: jest.fn().mockReturnValue('graphql'),
		getArgs: jest.fn().mockReturnValue([{}, {}, {req}, {}]),
		switchToHttp: jest.fn(),
		switchToRpc: jest.fn(),
		switchToWs: jest.fn(),
		getArgByIndex: jest.fn(),
	} as unknown as ExecutionContext;
}

describe('GqlAuthorizationGuard', () => {
	let guard: GqlAuthorizationGuard;
	let reflector: jest.Mocked<Reflector>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [GqlAuthorizationGuard, {provide: Reflector, useValue: {getAllAndOverride: jest.fn()}}],
		}).compile();

		guard = module.get<GqlAuthorizationGuard>(GqlAuthorizationGuard);
		reflector = module.get(Reflector);
	});

	it('should be defined', () => {
		expect(guard).toBeDefined();
	});

	it('allows access when route is marked as public', () => {
		reflector.getAllAndOverride.mockReturnValueOnce(true);
		const context = createMockContext({user: null});

		expect(guard.canActivate(context)).toBe(true);
	});

	it('allows access when no roles are required', () => {
		reflector.getAllAndOverride.mockReturnValueOnce(false).mockReturnValueOnce(null);
		const context = createMockContext({user: {role: UserRole.READER}});

		expect(guard.canActivate(context)).toBe(true);
	});

	it('allows access when user has a required role', () => {
		reflector.getAllAndOverride.mockReturnValueOnce(false).mockReturnValueOnce([UserRole.ADMIN]);
		const context = createMockContext({user: {role: UserRole.ADMIN}});

		expect(guard.canActivate(context)).toBe(true);
	});

	it('throws OrchardApiError when user is missing', () => {
		reflector.getAllAndOverride.mockReturnValueOnce(false).mockReturnValueOnce([UserRole.ADMIN]);
		const context = createMockContext({user: null});

		expect(() => guard.canActivate(context)).toThrow(OrchardApiError);
	});

	it('throws OrchardApiError when user lacks required role', () => {
		reflector.getAllAndOverride.mockReturnValueOnce(false).mockReturnValueOnce([UserRole.ADMIN]);
		const context = createMockContext({user: {role: UserRole.READER}});

		expect(() => guard.canActivate(context)).toThrow(OrchardApiError);
	});
});
