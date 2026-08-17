/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import type {ExecutionContext} from '@nestjs/common';
import {Reflector} from '@nestjs/core';
import {ConfigService} from '@nestjs/config';
import {GqlExecutionContext} from '@nestjs/graphql';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {UserRole} from '#server/modules/user/user.enums';
import {AuthService} from '#server/modules/auth/auth.service';
/* Local Dependencies */
import {GqlAuthenticationGuard} from './authentication.guard.js';

describe('GqlAuthenticationGuard', () => {
	let guard: GqlAuthenticationGuard;
	let reflector: jest.Mocked<Reflector>;
	let configService: jest.Mocked<ConfigService>;
	let authService: jest.Mocked<AuthService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				GqlAuthenticationGuard,
				{provide: Reflector, useValue: {getAllAndOverride: jest.fn()}},
				{provide: ConfigService, useValue: {get: jest.fn()}},
				{provide: AuthService, useValue: {validateAccessToken: jest.fn()}},
			],
		}).compile();

		guard = module.get<GqlAuthenticationGuard>(GqlAuthenticationGuard);
		reflector = module.get(Reflector);
		configService = module.get(ConfigService);
		authService = module.get(AuthService) as jest.Mocked<AuthService>;
	});

	afterEach(() => {
		jest.restoreAllMocks();
	});

	/** Builds a mock ExecutionContext with stubs for the methods the guard calls */
	const makeContext = () =>
		({
			getHandler: jest.fn(),
			getClass: jest.fn(),
		}) as unknown as ExecutionContext;

	/** Installs a GqlExecutionContext.create stub that returns an info/context shape */
	const stubGqlContext = (info: any, req: any) => {
		jest.spyOn(GqlExecutionContext, 'create').mockReturnValue({
			getInfo: () => info,
			getContext: () => ({req}),
		} as unknown as GqlExecutionContext);
	};

	it('should be defined', () => {
		expect(guard).toBeDefined();
	});

	it('allows access when route is marked as public', async () => {
		reflector.getAllAndOverride.mockReturnValueOnce(true);

		const result = await guard.canActivate(makeContext());

		expect(result).toBe(true);
	});

	it('validates the subscription token from connectionParams and attaches user', async () => {
		reflector.getAllAndOverride.mockReturnValueOnce(false);
		const req: any = {connectionParams: {authorization: 'jwt-access-token'}};
		stubGqlContext({operation: {operation: 'subscription'}}, req);
		authService.validateAccessToken.mockResolvedValueOnce({
			sub: 'user-1',
			username: 'alice',
			role: UserRole.ADMIN,
			type: 'access',
		} as any);

		const result = await guard.canActivate(makeContext());

		expect(result).toBe(true);
		expect(authService.validateAccessToken).toHaveBeenCalledWith('jwt-access-token');
		expect(req.user).toEqual({id: 'user-1', name: 'alice', role: UserRole.ADMIN, auth_token: 'jwt-access-token'});
	});

	it('throws AuthenticationError when subscription connectionParams lack a token and dev bypass is off', async () => {
		reflector.getAllAndOverride.mockReturnValueOnce(false);
		configService.get.mockReturnValue(false);
		stubGqlContext({operation: {operation: 'subscription'}}, {connectionParams: {}});

		await expect(guard.canActivate(makeContext())).rejects.toThrow(OrchardApiError);
		expect(authService.validateAccessToken).not.toHaveBeenCalled();
	});

	it('returns a dev user for unauthenticated subscriptions when dev bypass is on', async () => {
		reflector.getAllAndOverride.mockReturnValueOnce(false);
		configService.get.mockReturnValue(true);
		const req: any = {connectionParams: {}};
		stubGqlContext({operation: {operation: 'subscription'}}, req);

		const result = await guard.canActivate(makeContext());

		expect(result).toBe(true);
		expect(req.user).toEqual({id: 'dev-user', name: 'dev', role: UserRole.ADMIN});
	});

	it('throws AuthenticationError when the subscription token fails validation', async () => {
		reflector.getAllAndOverride.mockReturnValueOnce(false);
		stubGqlContext({operation: {operation: 'subscription'}}, {connectionParams: {authorization: 'bad'}});
		authService.validateAccessToken.mockRejectedValueOnce(new Error('invalid'));

		await expect(guard.canActivate(makeContext())).rejects.toThrow(OrchardApiError);
	});

	it('throws OrchardApiError when user is missing and dev_auth_bypass is disabled', () => {
		configService.get.mockReturnValue(false);

		expect(() => guard.handleRequest(null, null, null, makeContext())).toThrow(OrchardApiError);
	});

	it('throws OrchardApiError when user is missing and dev_auth_bypass is not set', () => {
		configService.get.mockReturnValue(undefined);

		expect(() => guard.handleRequest(null, null, null, makeContext())).toThrow(OrchardApiError);
	});

	it('returns dev user when DEV_AUTH_BYPASS is enabled and no auth header present', () => {
		configService.get.mockReturnValue(true);
		const mock_request = {headers: {}};
		jest.spyOn(guard, 'getRequest').mockReturnValue(mock_request);

		const result = guard.handleRequest(null, null, null, makeContext());

		expect(result).toEqual({id: 'dev-user', name: 'dev', role: UserRole.ADMIN});
	});

	it('returns user when authentication succeeds', () => {
		configService.get.mockReturnValue(true);
		const mock_user = {id: '1', name: 'Alice', role: UserRole.ADMIN};

		const result = guard.handleRequest(null, mock_user, null, makeContext());

		expect(result).toEqual(mock_user);
	});

	it('throws OrchardApiError when error is present', () => {
		configService.get.mockReturnValue(true);

		expect(() => guard.handleRequest(new Error('jwt expired'), null, null, makeContext())).toThrow(OrchardApiError);
	});
});
