/* Core Dependencies */
import {UnauthorizedException} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {UserRole} from '#server/modules/user/user.enums';
/* Local Dependencies */
import {AuthStrategy} from './auth.strategy.js';

describe('AuthStrategy', () => {
	let strategy: AuthStrategy;

	beforeEach(() => {
		const config_service = {get: jest.fn().mockReturnValue('test-secret')} as unknown as ConfigService;
		strategy = new AuthStrategy(config_service);
	});

	/** Builds a mock request carrying a Bearer authorization header */
	const makeRequest = () => ({get: jest.fn().mockReturnValue('Bearer signed-token')}) as any;

	it('maps a valid access token payload to the request user', async () => {
		const user = await strategy.validate(makeRequest(), {
			sub: 'user-1',
			username: 'alice',
			role: UserRole.ADMIN,
			type: 'access',
		});

		expect(user).toEqual({id: 'user-1', name: 'alice', role: UserRole.ADMIN, auth_token: 'signed-token'});
	});

	it('rejects a refresh token presented as a bearer credential', async () => {
		await expect(
			strategy.validate(makeRequest(), {
				sub: 'user-1',
				username: 'alice',
				role: UserRole.ADMIN,
				type: 'refresh',
			}),
		).rejects.toThrow(UnauthorizedException);
	});
});
