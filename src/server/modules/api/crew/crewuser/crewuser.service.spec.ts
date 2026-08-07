/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
/* Application Dependencies */
import {ErrorService} from '#server/modules/error/error.service';
import {UserService} from '#server/modules/user/user.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {User} from '#server/modules/user/user.entity';
import {UserRole} from '#server/modules/user/user.enums';
/* Local Dependencies */
import {CrewUserService} from './crewuser.service.js';
import {OrchardCrewUser} from './crewuser.model.js';
import {UserNameUpdateInput, UserPasswordUpdateInput} from './crewuser.input.js';

describe('CrewUserService', () => {
	let crewUserService: CrewUserService;
	let errorService: jest.Mocked<ErrorService>;
	let userService: jest.Mocked<UserService>;

	// helper method to create mock user
	const createMockUser = (overrides?: Partial<User>): User => {
		return {
			id: '1',
			name: 'TestUser',
			password_hash: 'hashed',
			role: UserRole.READER,
			active: true,
			created_at: new Date('2024-01-01'),
			updated_at: new Date('2024-01-02'),
			...overrides,
		} as User;
	};

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				CrewUserService,
				{provide: ErrorService, useValue: {resolveError: jest.fn()}},
				{
					provide: UserService,
					useValue: {
						getUserById: jest.fn(),
						updateUser: jest.fn(),
						validatePassword: jest.fn(),
					},
				},
			],
		}).compile();

		crewUserService = module.get<CrewUserService>(CrewUserService);
		errorService = module.get(ErrorService);
		userService = module.get(UserService);
	});

	it('should be defined', () => {
		expect(crewUserService).toBeDefined();
	});

	describe('getUser', () => {
		it('returns OrchardCrewUser on success', async () => {
			const mock_user = createMockUser();
			userService.getUserById.mockResolvedValue(mock_user);

			const result = await crewUserService.getUser('TAG', '1');

			expect(result).toBeInstanceOf(OrchardCrewUser);
			expect(result.id).toBe('1');
			expect(result.name).toBe('TestUser');
			expect(result.role).toBe(UserRole.READER);
			expect(result.active).toBe(true);
			expect(userService.getUserById).toHaveBeenCalledWith('1');
		});

		it('wraps errors via resolveError and throws OrchardApiError', async () => {
			userService.getUserById.mockRejectedValue(new Error('Database error'));
			errorService.resolveError.mockReturnValue({code: OrchardErrorCode.UserError});

			await expect(crewUserService.getUser('GET_USER_TAG', '1')).rejects.toBeInstanceOf(OrchardApiError);

			const calls = errorService.resolveError.mock.calls;
			const [, , tag_arg, code_arg] = calls[calls.length - 1];
			expect(tag_arg).toBe('GET_USER_TAG');
			expect(code_arg).toEqual({errord: OrchardErrorCode.UserError});
		});
	});

	describe('updateUserName', () => {
		it('returns OrchardCrewUser with updated name on success', async () => {
			const mock_user = createMockUser({name: 'NewName'});
			userService.updateUser.mockResolvedValue(mock_user);

			const input: UserNameUpdateInput = {name: 'NewName'};
			const result = await crewUserService.updateUserName('TAG', '1', input);

			expect(result).toBeInstanceOf(OrchardCrewUser);
			expect(result.name).toBe('NewName');
			expect(userService.updateUser).toHaveBeenCalledWith('1', {name: 'NewName'});
		});

		it('wraps errors via resolveError and throws OrchardApiError', async () => {
			userService.updateUser.mockRejectedValue(new Error('Update failed'));
			errorService.resolveError.mockReturnValue({code: OrchardErrorCode.UserError});

			const input: UserNameUpdateInput = {name: 'NewName'};
			await expect(crewUserService.updateUserName('UPDATE_TAG', '1', input)).rejects.toBeInstanceOf(OrchardApiError);

			const calls = errorService.resolveError.mock.calls;
			const [, , tag_arg, code_arg] = calls[calls.length - 1];
			expect(tag_arg).toBe('UPDATE_TAG');
			expect(code_arg).toEqual({errord: OrchardErrorCode.UserError});
		});
	});

	describe('updateUserPassword', () => {
		it('returns OrchardCrewUser with updated password on success', async () => {
			const mock_user = createMockUser();
			const mock_updated_user = createMockUser({password_hash: 'new_hashed'});
			userService.getUserById.mockResolvedValue(mock_user);
			userService.validatePassword.mockResolvedValue(true);
			userService.updateUser.mockResolvedValue(mock_updated_user);

			const input: UserPasswordUpdateInput = {password_old: 'old_pass', password_new: 'new_pass'};
			const result = await crewUserService.updateUserPassword('TAG', '1', input);

			expect(result).toBeInstanceOf(OrchardCrewUser);
			expect(userService.getUserById).toHaveBeenCalledWith('1');
			expect(userService.validatePassword).toHaveBeenCalledWith(mock_user, 'old_pass');
			expect(userService.updateUser).toHaveBeenCalledWith('1', {}, 'new_pass');
		});

		it('throws OrchardApiError when user not found', async () => {
			userService.getUserById.mockResolvedValue(null);
			errorService.resolveError.mockReturnValue({code: OrchardErrorCode.UserError});

			const input: UserPasswordUpdateInput = {password_old: 'old_pass', password_new: 'new_pass'};
			await expect(crewUserService.updateUserPassword('TAG', '1', input)).rejects.toBeInstanceOf(OrchardApiError);
		});

		it('throws OrchardApiError when old password is invalid', async () => {
			const mock_user = createMockUser();
			userService.getUserById.mockResolvedValue(mock_user);
			userService.validatePassword.mockResolvedValue(false);
			errorService.resolveError.mockReturnValue({code: OrchardErrorCode.InvalidPasswordError});

			const input: UserPasswordUpdateInput = {password_old: 'wrong_pass', password_new: 'new_pass'};
			await expect(crewUserService.updateUserPassword('TAG', '1', input)).rejects.toBeInstanceOf(OrchardApiError);

			expect(userService.validatePassword).toHaveBeenCalledWith(mock_user, 'wrong_pass');
		});

		it('wraps errors via resolveError with correct tag', async () => {
			const mock_user = createMockUser();
			userService.getUserById.mockResolvedValue(mock_user);
			userService.validatePassword.mockResolvedValue(true);
			userService.updateUser.mockRejectedValue(new Error('Update failed'));
			errorService.resolveError.mockReturnValue({code: OrchardErrorCode.UserError});

			const input: UserPasswordUpdateInput = {password_old: 'old_pass', password_new: 'new_pass'};
			await expect(crewUserService.updateUserPassword('PWD_UPDATE_TAG', '1', input)).rejects.toBeInstanceOf(OrchardApiError);

			const calls = errorService.resolveError.mock.calls;
			const [, , tag_arg, code_arg] = calls[calls.length - 1];
			expect(tag_arg).toBe('PWD_UPDATE_TAG');
			expect(code_arg).toEqual({errord: OrchardErrorCode.UserError});
		});
	});
});
