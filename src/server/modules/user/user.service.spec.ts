/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
/* Vendor Dependencies */
import {getRepositoryToken} from '@nestjs/typeorm';
import {expect} from '@jest/globals';
import * as bcrypt from 'bcrypt';
/* Local Dependencies */
import {UserService} from './user.service.js';
import {User} from './user.entity.js';
import {UserRole} from './user.enums.js';

jest.mock('bcrypt');

describe('UserService', () => {
	let userService: UserService;
	let mockRepository: any;

	beforeEach(async () => {
		mockRepository = {
			findOne: jest.fn(),
			find: jest.fn(),
			count: jest.fn(),
			create: jest.fn(),
			save: jest.fn(),
		};

		const module: TestingModule = await Test.createTestingModule({
			providers: [UserService, {provide: getRepositoryToken(User), useValue: mockRepository}],
		}).compile();

		userService = module.get<UserService>(UserService);
	});

	it('should be defined', () => {
		expect(userService).toBeDefined();
	});

	describe('getUserByName', () => {
		it('returns user when found', async () => {
			const mock_user = {id: '1', name: 'Admin', role: UserRole.ADMIN} as User;
			mockRepository.findOne.mockResolvedValue(mock_user);
			const user = await userService.getUserByName('Admin');
			expect(user).toBeDefined();
			expect(user.name).toBe('Admin');
			expect(mockRepository.findOne).toHaveBeenCalledWith({where: {name: 'Admin'}});
		});

		it('returns null when user not found', async () => {
			mockRepository.findOne.mockResolvedValue(null);
			const user = await userService.getUserByName('NonExistent');
			expect(user).toBeNull();
		});
	});

	describe('getUserById', () => {
		it('returns user when found', async () => {
			const mock_user = {id: '123', name: 'TestUser', role: UserRole.READER} as User;
			mockRepository.findOne.mockResolvedValue(mock_user);
			const user = await userService.getUserById('123');
			expect(user).toBeDefined();
			expect(user.id).toBe('123');
			expect(mockRepository.findOne).toHaveBeenCalledWith({where: {id: '123'}});
		});

		it('returns null when user not found', async () => {
			mockRepository.findOne.mockResolvedValue(null);
			const user = await userService.getUserById('999');
			expect(user).toBeNull();
		});
	});

	describe('getUsers', () => {
		it('returns all users', async () => {
			const mock_users = [
				{id: '1', name: 'Admin', role: UserRole.ADMIN} as User,
				{id: '2', name: 'User1', role: UserRole.READER} as User,
			];
			mockRepository.find.mockResolvedValue(mock_users);
			const users = await userService.getUsers();
			expect(users).toHaveLength(2);
			expect(users[0].name).toBe('Admin');
			expect(users[1].name).toBe('User1');
		});

		it('returns empty array when no users', async () => {
			mockRepository.find.mockResolvedValue([]);
			const users = await userService.getUsers();
			expect(users).toHaveLength(0);
		});
	});

	describe('getUserCount', () => {
		it('returns correct count', async () => {
			mockRepository.count.mockResolvedValue(5);
			const count = await userService.getUserCount();
			expect(count).toBe(5);
		});

		it('returns 0 when no users', async () => {
			mockRepository.count.mockResolvedValue(0);
			const count = await userService.getUserCount();
			expect(count).toBe(0);
		});
	});

	describe('validatePassword', () => {
		it('returns true when password matches', async () => {
			const mock_user = {id: '1', name: 'Admin', password_hash: 'hashed'} as User;
			(bcrypt.compare as jest.Mock).mockResolvedValue(true);
			const is_valid = await userService.validatePassword(mock_user, 'password123');
			expect(is_valid).toBe(true);
			expect(bcrypt.compare).toHaveBeenCalledWith('password123', 'hashed');
		});

		it('returns false when password does not match', async () => {
			const mock_user = {id: '1', name: 'Admin', password_hash: 'hashed'} as User;
			(bcrypt.compare as jest.Mock).mockResolvedValue(false);
			const is_valid = await userService.validatePassword(mock_user, 'wrong_password');
			expect(is_valid).toBe(false);
		});
	});

	describe('createUser', () => {
		it('creates first user as admin', async () => {
			mockRepository.count.mockResolvedValue(0);
			(bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
			const mock_created_user = {name: 'Admin', password_hash: 'hashed_password', role: UserRole.ADMIN};
			mockRepository.create.mockReturnValue(mock_created_user);
			mockRepository.save.mockResolvedValue({...mock_created_user, id: '1'});

			const user = await userService.createUser('Admin', 'password123', UserRole.ADMIN);

			expect(bcrypt.hash).toHaveBeenCalledWith('password123', 10);
			expect(mockRepository.create).toHaveBeenCalledWith({
				name: 'Admin',
				password_hash: 'hashed_password',
				role: UserRole.ADMIN,
				label: null,
				created_at: expect.any(Number),
			});
			expect(user.id).toBe('1');
			expect(user.role).toBe(UserRole.ADMIN);
		});

		it('creates subsequent users as members', async () => {
			mockRepository.count.mockResolvedValue(1);
			(bcrypt.hash as jest.Mock).mockResolvedValue('hashed_password');
			const mock_created_user = {name: 'User1', password_hash: 'hashed_password', role: UserRole.READER};
			mockRepository.create.mockReturnValue(mock_created_user);
			mockRepository.save.mockResolvedValue({...mock_created_user, id: '2'});

			const user = await userService.createUser('User1', 'password456', UserRole.READER);

			expect(mockRepository.create).toHaveBeenCalledWith({
				name: 'User1',
				password_hash: 'hashed_password',
				role: UserRole.READER,
				label: null,
				created_at: expect.any(Number),
			});
			expect(user.role).toBe(UserRole.READER);
		});
	});

	describe('updateUser', () => {
		it('updates user without password change', async () => {
			const existing_user = {id: '1', name: 'OldName', role: UserRole.READER} as User;
			mockRepository.findOne.mockResolvedValue(existing_user);
			mockRepository.save.mockResolvedValue({...existing_user, name: 'NewName'});

			const updated = await userService.updateUser('1', {name: 'NewName'});

			expect(updated.name).toBe('NewName');
			expect(mockRepository.save).toHaveBeenCalledWith({...existing_user, name: 'NewName'});
		});

		it('updates user with password change', async () => {
			const existing_user = {id: '1', name: 'Admin', role: UserRole.ADMIN} as User;
			mockRepository.findOne.mockResolvedValue(existing_user);
			(bcrypt.hash as jest.Mock).mockResolvedValue('new_hashed_password');
			mockRepository.save.mockResolvedValue({
				...existing_user,
				password_hash: 'new_hashed_password',
			});

			const updated = await userService.updateUser('1', {}, 'new_password');

			expect(bcrypt.hash).toHaveBeenCalledWith('new_password', 10);
			expect(mockRepository.save).toHaveBeenCalledWith({
				...existing_user,
				password_hash: 'new_hashed_password',
			});
			expect(updated.password_hash).toBe('new_hashed_password');
		});

		it('throws error when user not found', async () => {
			mockRepository.findOne.mockResolvedValue(null);

			await expect(userService.updateUser('999', {name: 'NewName'})).rejects.toThrow('User not found');
		});
	});
});
