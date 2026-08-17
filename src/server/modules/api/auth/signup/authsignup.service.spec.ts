/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Vendor Dependencies */
import {DateTime} from 'luxon';
/* Application Dependencies */
import {AuthService} from '#server/modules/auth/auth.service';
import {ErrorService} from '#server/modules/error/error.service';
import {UserService} from '#server/modules/user/user.service';
import {InviteService} from '#server/modules/invite/invite.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {UserRole} from '#server/modules/user/user.enums';
import {User} from '#server/modules/user/user.entity';
import {Invite} from '#server/modules/invite/invite.entity';
/* Local Dependencies */
import {AuthSignupService} from './authsignup.service.js';
import {AuthSignupInput} from './authsignup.input.js';

describe('AuthSignupService', () => {
	let authSignupService: AuthSignupService;
	let authService: jest.Mocked<AuthService>;
	let errorService: jest.Mocked<ErrorService>;
	let userService: jest.Mocked<UserService>;
	let inviteService: jest.Mocked<InviteService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AuthSignupService,
				{
					provide: AuthService,
					useValue: {
						getToken: jest.fn(),
					},
				},
				{
					provide: ErrorService,
					useValue: {
						resolveError: jest.fn(),
					},
				},
				{
					provide: UserService,
					useValue: {
						getUserByName: jest.fn(),
						createUser: jest.fn(),
					},
				},
				{
					provide: InviteService,
					useValue: {
						getValidInvite: jest.fn(),
						claimInvite: jest.fn(),
					},
				},
			],
		}).compile();

		authSignupService = module.get<AuthSignupService>(AuthSignupService);
		authService = module.get(AuthService);
		errorService = module.get(ErrorService);
		userService = module.get(UserService);
		inviteService = module.get(InviteService);
	});

	it('should be defined', () => {
		expect(authSignupService).toBeDefined();
	});

	describe('signup', () => {
		it('successfully signs up user with valid invite', async () => {
			const signup_input: AuthSignupInput = {
				key: 'VALID123TOKN',
				name: 'NewUser',
				password: 'password123',
			};

			const mock_invite = {
				id: 'invite-id',
				token: 'VALID123TOKN',
				role: UserRole.READER,
				label: 'Test User',
				created_by: {id: 'admin1'} as User,
				used_at: null,
				expires_at: null,
				created_at: Math.floor(DateTime.now().toSeconds()),
			} as Invite;

			const mock_user = {
				id: 'new-user-id',
				name: 'NewUser',
				role: UserRole.READER,
				label: 'Test User',
				active: true,
				created_at: Math.floor(DateTime.now().toSeconds()),
			} as User;

			const mock_token = {
				access_token: 'access_token_123',
				refresh_token: 'refresh_token_456',
			};

			inviteService.getValidInvite.mockResolvedValue(mock_invite);
			userService.getUserByName.mockResolvedValue(null);
			userService.createUser.mockResolvedValue(mock_user);
			inviteService.claimInvite.mockResolvedValue(mock_invite);
			authService.getToken.mockResolvedValue(mock_token);

			const result = await authSignupService.signup('SIGNUP_TAG', signup_input);

			expect(result.access_token).toBe('access_token_123');
			expect(result.refresh_token).toBe('refresh_token_456');
			expect(inviteService.getValidInvite).toHaveBeenCalledWith('VALID123TOKN');
			expect(userService.getUserByName).toHaveBeenCalledWith('NewUser');
			expect(userService.createUser).toHaveBeenCalledWith('NewUser', 'password123', UserRole.READER, 'Test User');
			expect(inviteService.claimInvite).toHaveBeenCalledWith('invite-id', 'new-user-id');
			expect(authService.getToken).toHaveBeenCalledWith('new-user-id', 'password123');
		});

		it('throws OrchardApiError when invite is invalid', async () => {
			const signup_input: AuthSignupInput = {
				key: 'INVALID1TOKN',
				name: 'NewUser',
				password: 'password123',
			};

			inviteService.getValidInvite.mockResolvedValue(null);
			errorService.resolveError.mockReturnValue({code: OrchardErrorCode.InviteInvalidError});

			await expect(authSignupService.signup('SIGNUP_TAG', signup_input)).rejects.toBeInstanceOf(OrchardApiError);

			expect(inviteService.getValidInvite).toHaveBeenCalledWith('INVALID1TOKN');
			expect(errorService.resolveError).toHaveBeenCalledWith(expect.anything(), OrchardErrorCode.InviteInvalidError, 'SIGNUP_TAG', {
				errord: OrchardErrorCode.SignupError,
			});
		});

		it('throws OrchardApiError when username already exists', async () => {
			const signup_input: AuthSignupInput = {
				key: 'VALID123TOKN',
				name: 'ExistingUser',
				password: 'password123',
			};

			const mock_invite = {
				id: 'invite-id',
				token: 'VALID123TOKN',
				role: UserRole.READER,
				label: 'Test User',
				created_by: {id: 'admin1'} as User,
			} as Invite;

			const existing_user = {
				id: 'existing-user-id',
				name: 'ExistingUser',
				role: UserRole.READER,
			} as User;

			inviteService.getValidInvite.mockResolvedValue(mock_invite);
			userService.getUserByName.mockResolvedValue(existing_user);
			errorService.resolveError.mockReturnValue({code: OrchardErrorCode.UniqueUsernameError});

			await expect(authSignupService.signup('SIGNUP_TAG', signup_input)).rejects.toBeInstanceOf(OrchardApiError);

			expect(userService.getUserByName).toHaveBeenCalledWith('ExistingUser');
			expect(errorService.resolveError).toHaveBeenCalledWith(expect.anything(), OrchardErrorCode.UniqueUsernameError, 'SIGNUP_TAG', {
				errord: OrchardErrorCode.SignupError,
			});
		});

		it('throws OrchardApiError when token generation fails', async () => {
			const signup_input: AuthSignupInput = {
				key: 'VALID123TOKN',
				name: 'NewUser',
				password: 'password123',
			};

			const mock_invite = {
				id: 'invite-id',
				token: 'VALID123TOKN',
				role: UserRole.READER,
				label: 'Test User',
				created_by: {id: 'admin1'} as User,
			} as Invite;

			const mock_user = {
				id: 'new-user-id',
				name: 'NewUser',
				role: UserRole.READER,
			} as User;

			inviteService.getValidInvite.mockResolvedValue(mock_invite);
			userService.getUserByName.mockResolvedValue(null);
			userService.createUser.mockResolvedValue(mock_user);
			inviteService.claimInvite.mockResolvedValue(mock_invite);
			authService.getToken.mockResolvedValue(null as any);
			errorService.resolveError.mockReturnValue({code: OrchardErrorCode.AuthenticationError});

			await expect(authSignupService.signup('SIGNUP_TAG', signup_input)).rejects.toBeInstanceOf(OrchardApiError);

			expect(errorService.resolveError).toHaveBeenCalledWith(expect.anything(), OrchardErrorCode.AuthenticationError, 'SIGNUP_TAG', {
				errord: OrchardErrorCode.SignupError,
			});
		});

		it('throws OrchardApiError on unexpected errors', async () => {
			const signup_input: AuthSignupInput = {
				key: 'VALID123TOKN',
				name: 'NewUser',
				password: 'password123',
			};

			const error = new Error('Unexpected error');
			inviteService.getValidInvite.mockRejectedValue(error);
			errorService.resolveError.mockReturnValue({code: OrchardErrorCode.SignupError});

			await expect(authSignupService.signup('SIGNUP_TAG', signup_input)).rejects.toBeInstanceOf(OrchardApiError);

			expect(errorService.resolveError).toHaveBeenCalledWith(expect.anything(), error, 'SIGNUP_TAG', {
				errord: OrchardErrorCode.SignupError,
			});
		});
	});
});
