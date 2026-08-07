/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {AuthService} from '@server/modules/auth/auth.service';
import {ErrorService} from '@server/modules/error/error.service';
import {UserService} from '@server/modules/user/user.service';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
import {UserRole} from '@server/modules/user/user.enums';
/* Local Dependencies */
import {AuthInitializationService} from './initialization.service.js';
import {OrchardAuthentication} from '../authentication/authentication.model.js';
import {OrchardInitialization} from './initialization.model.js';
import {InitializationInput} from './initialization.input.js';

describe('AtuhInitializationService', () => {
	let initializationService: AuthInitializationService;
	let authService: jest.Mocked<AuthService>;
	let errorService: jest.Mocked<ErrorService>;
	let userService: jest.Mocked<UserService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AuthInitializationService,
				{
					provide: AuthService,
					useValue: {
						validateSetupKey: jest.fn(),
						getToken: jest.fn(),
						getInitialization: jest.fn(),
					},
				},
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
				{
					provide: UserService,
					useValue: {
						getUserByName: jest.fn(),
						createUser: jest.fn(),
					},
				},
			],
		}).compile();

		initializationService = module.get<AuthInitializationService>(AuthInitializationService);
		authService = module.get(AuthService);
		errorService = module.get(ErrorService);
		userService = module.get(UserService);
	});

	it('should be defined', () => {
		expect(initializationService).toBeDefined();
	});

	describe('initialize', () => {
		const mock_input: InitializationInput = {
			key: 'setup-key',
			name: 'testuser',
			password: 'testpass',
		};

		it('returns OrchardAuthentication on successful initialization', async () => {
			authService.validateSetupKey.mockResolvedValue(true);
			userService.getUserByName.mockResolvedValue(null);
			userService.createUser.mockResolvedValue({id: 'user-id', name: 'testuser'} as any);
			authService.getToken.mockResolvedValue({access_token: 'a', refresh_token: 'r'} as any);

			const result = await initializationService.initialize('TAG', mock_input);

			expect(result).toBeInstanceOf(OrchardAuthentication);
			expect(authService.validateSetupKey).toHaveBeenCalledWith(mock_input.key);
			expect(userService.getUserByName).toHaveBeenCalledWith(mock_input.name);
			expect(userService.createUser).toHaveBeenCalledWith(mock_input.name, mock_input.password, UserRole.ADMIN);
			expect(authService.getToken).toHaveBeenCalledWith('user-id', mock_input.password);
		});

		it('throws OrchardApiError when setup key is invalid', async () => {
			authService.validateSetupKey.mockResolvedValue(false);
			errorService.resolveError.mockReturnValue({code: OrchardErrorCode.InitializationKeyError});

			await expect(initializationService.initialize('TAG', mock_input)).rejects.toBeInstanceOf(OrchardApiError);

			expect(authService.validateSetupKey).toHaveBeenCalledWith(mock_input.key);
			expect(userService.getUserByName).not.toHaveBeenCalled();
		});

		it('throws OrchardApiError when username already exists', async () => {
			authService.validateSetupKey.mockResolvedValue(true);
			userService.getUserByName.mockResolvedValue({id: 'existing-user', name: 'testuser'} as any);
			errorService.resolveError.mockReturnValue({code: OrchardErrorCode.UniqueUsernameError});

			await expect(initializationService.initialize('TAG', mock_input)).rejects.toBeInstanceOf(OrchardApiError);

			expect(userService.getUserByName).toHaveBeenCalledWith(mock_input.name);
			expect(userService.createUser).not.toHaveBeenCalled();
		});

		it('throws OrchardApiError when token generation fails', async () => {
			authService.validateSetupKey.mockResolvedValue(true);
			userService.getUserByName.mockResolvedValue(null);
			userService.createUser.mockResolvedValue({id: 'user-id', name: 'testuser'} as any);
			authService.getToken.mockResolvedValue(null);
			errorService.resolveError.mockReturnValue({code: OrchardErrorCode.AuthenticationError});

			await expect(initializationService.initialize('TAG', mock_input)).rejects.toBeInstanceOf(OrchardApiError);

			expect(authService.getToken).toHaveBeenCalledWith('user-id', mock_input.password);
		});

		it('wraps unexpected errors via resolveError and throws OrchardApiError', async () => {
			authService.validateSetupKey.mockRejectedValue(new Error('unexpected error'));
			errorService.resolveError.mockReturnValue({code: OrchardErrorCode.AuthenticationError});

			await expect(initializationService.initialize('MY_TAG', mock_input)).rejects.toBeInstanceOf(OrchardApiError);

			const calls = errorService.resolveError.mock.calls;
			const [, , tag_arg, code_arg] = calls[calls.length - 1];
			expect(tag_arg).toBe('MY_TAG');
			expect(code_arg).toEqual({errord: OrchardErrorCode.AuthenticationError});
		});
	});

	describe('getInitialization', () => {
		it('returns OrchardInitialization with true when system needs initialization', async () => {
			authService.getInitialization.mockResolvedValue(true);

			const result = await initializationService.getInitialization('TAG');

			expect(result).toBeInstanceOf(OrchardInitialization);
			expect(result.initialization).toBe(true);
			expect(authService.getInitialization).toHaveBeenCalled();
		});

		it('returns OrchardInitialization with false when system is already initialized', async () => {
			authService.getInitialization.mockResolvedValue(false);

			const result = await initializationService.getInitialization('TAG');

			expect(result).toBeInstanceOf(OrchardInitialization);
			expect(result.initialization).toBe(false);
			expect(authService.getInitialization).toHaveBeenCalled();
		});

		it('wraps errors via resolveError and throws OrchardApiError', async () => {
			authService.getInitialization.mockRejectedValue(new Error('database error'));
			errorService.resolveError.mockReturnValue({code: OrchardErrorCode.AuthenticationError});

			await expect(initializationService.getInitialization('MY_TAG')).rejects.toBeInstanceOf(OrchardApiError);

			const calls = errorService.resolveError.mock.calls;
			const [, , tag_arg, code_arg] = calls[calls.length - 1];
			expect(tag_arg).toBe('MY_TAG');
			expect(code_arg).toEqual({errord: OrchardErrorCode.AuthenticationError});
		});
	});
});
