/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {AuthService} from '@server/modules/auth/auth.service';
import {ErrorService} from '@server/modules/error/error.service';
import {UserService} from '@server/modules/user/user.service';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {AuthAuthenticationService} from './authentication.service.js';
import {OrchardAuthentication} from './authentication.model.js';

describe('AuthAuthenticationService', () => {
	let authenticationService: AuthAuthenticationService;
	let authService: jest.Mocked<AuthService>;
	let errorService: jest.Mocked<ErrorService>;
	let userService: jest.Mocked<UserService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AuthAuthenticationService,
				{provide: AuthService, useValue: {getToken: jest.fn(), refreshToken: jest.fn(), revokeToken: jest.fn()}},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
				{provide: UserService, useValue: {getUserByName: jest.fn()}},
			],
		}).compile();

		authenticationService = module.get<AuthAuthenticationService>(AuthAuthenticationService);
		authService = module.get(AuthService);
		errorService = module.get(ErrorService);
		userService = module.get(UserService);
	});

	it('should be defined', () => {
		expect(authenticationService).toBeDefined();
	});

	it('getToken returns OrchardAuthentication on success', async () => {
		userService.getUserByName.mockResolvedValue({id: '123'} as any);
		authService.getToken.mockResolvedValue({access_token: 'a', refresh_token: 'r'} as any);
		const result = await authenticationService.authenticate('TAG', {name: 'n', password: 'p'} as any);
		expect(result).toBeInstanceOf(OrchardAuthentication);
	});

	it('getToken wraps errors via resolveError and throws OrchardApiError', async () => {
		userService.getUserByName.mockResolvedValue({id: '123'} as any);
		authService.getToken.mockRejectedValue(new Error('boom'));
		errorService.resolveError.mockReturnValue({code: OrchardErrorCode.AuthenticationError});
		await expect(authenticationService.authenticate('MY_TAG', {name: 'n', password: 'p'} as any)).rejects.toBeInstanceOf(
			OrchardApiError,
		);
		const calls = errorService.resolveError.mock.calls;
		const [, , tag_arg, code_arg] = calls[calls.length - 1];
		expect(tag_arg).toBe('MY_TAG');
		expect(code_arg).toEqual({errord: OrchardErrorCode.AuthenticationError});
	});

	it('refreshAuthentication returns OrchardAuthentication on success', async () => {
		authService.refreshToken.mockResolvedValue({access_token: 'a', refresh_token: 'r'} as any);
		const result = await authenticationService.refreshAuthentication('TAG', 'r');
		expect(result).toBeInstanceOf(OrchardAuthentication);
	});

	it('revokeAuthentication returns true on success', async () => {
		authService.revokeToken.mockResolvedValue(true as any);
		const result = await authenticationService.revokeAuthentication('TAG', 'r');
		expect(result).toBe(true);
	});
});
