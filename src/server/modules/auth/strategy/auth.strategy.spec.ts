/* Core Dependencies */
import {UnauthorizedException} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {UserRole} from '#server/modules/user/user.enums';
import type {AuthService} from '#server/modules/auth/auth.service';
import type {JwtPayload} from '#server/modules/auth/auth.types';
/* Local Dependencies */
import {AuthStrategy} from './auth.strategy.js';

describe('AuthStrategy', () => {
	let strategy: AuthStrategy;
	let authService: jest.Mocked<Pick<AuthService, 'getAuthenticatedUser'>>;

	beforeEach(() => {
		const config_service = {get: jest.fn().mockReturnValue('test-secret')} as unknown as ConfigService;
		authService = {getAuthenticatedUser: jest.fn()};
		strategy = new AuthStrategy(config_service, authService as unknown as AuthService);
	});

	/** Builds a mock request carrying a Bearer authorization header */
	const makeRequest = () => ({get: jest.fn().mockReturnValue('Bearer signed-token')}) as any;

	/** A valid access token payload */
	const access_payload: JwtPayload = {
		sub: 'user-1',
		username: 'alice',
		role: UserRole.ADMIN,
		type: 'access',
	};

	it('maps an access token to the stored user and its current role', async () => {
		authService.getAuthenticatedUser.mockResolvedValueOnce({id: 'user-1', name: 'alice', role: UserRole.READER, active: true} as any);

		const user = await strategy.validate(makeRequest(), access_payload);

		expect(authService.getAuthenticatedUser).toHaveBeenCalledWith(access_payload);
		expect(user).toEqual({id: 'user-1', name: 'alice', role: UserRole.READER, auth_token: 'signed-token'});
	});

	it('rejects an access token when the stored user is rejected', async () => {
		authService.getAuthenticatedUser.mockRejectedValueOnce(new UnauthorizedException('User account has been deactivated'));

		await expect(strategy.validate(makeRequest(), access_payload)).rejects.toThrow(UnauthorizedException);
	});

	it('rejects a refresh token presented as a bearer credential', async () => {
		await expect(strategy.validate(makeRequest(), {...access_payload, type: 'refresh'})).rejects.toThrow(UnauthorizedException);
	});
});
