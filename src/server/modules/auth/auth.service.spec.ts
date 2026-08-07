/* Core Dependencies */
import {Test, TestingModule} from '@nestjs/testing';
import {expect} from '@jest/globals';
import {UnauthorizedException} from '@nestjs/common';
/* Vendor Dependencies */
import {ConfigService} from '@nestjs/config';
import {JwtService} from '@nestjs/jwt';
import {getRepositoryToken} from '@nestjs/typeorm';
/* Application Dependencies */
import {UserService} from '#server/modules/user/user.service';
import {UserRole} from '#server/modules/user/user.enums';
/* Local Dependencies */
import {AuthService} from './auth.service.js';
import {TokenBlacklist} from './token-blacklist.entity.js';

describe('AuthService', () => {
	let authService: AuthService;
	let jwtService: jest.Mocked<JwtService>;
	let userService: jest.Mocked<UserService>;
	let tokenBlacklistRepository: any;
	let configService: jest.Mocked<ConfigService>;

	beforeEach(async () => {
		const module: TestingModule = await Test.createTestingModule({
			providers: [
				AuthService,
				{provide: ConfigService, useValue: {get: jest.fn()}},
				{provide: JwtService, useValue: {signAsync: jest.fn(), verifyAsync: jest.fn()}},
				{
					provide: UserService,
					useValue: {
						getUserById: jest.fn().mockResolvedValue({id: '1', name: 'Admin', role: UserRole.ADMIN, active: true}),
						validatePassword: jest.fn().mockResolvedValue(true),
						getUserCount: jest.fn().mockResolvedValue(1),
					},
				},
				{
					provide: getRepositoryToken(TokenBlacklist),
					useValue: {
						findOne: jest.fn().mockResolvedValue(null),
						save: jest.fn().mockResolvedValue({}),
						delete: jest.fn().mockResolvedValue({affected: 0}),
					},
				},
			],
		}).compile();

		authService = module.get<AuthService>(AuthService);
		configService = module.get(ConfigService);

		jwtService = module.get(JwtService);
		userService = module.get(UserService);
		tokenBlacklistRepository = module.get(getRepositoryToken(TokenBlacklist));
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	it('should be defined', () => {
		expect(authService).toBeDefined();
	});

	it('getToken returns tokens when password matches', async () => {
		jwtService.signAsync.mockResolvedValueOnce('a');
		jwtService.signAsync.mockResolvedValueOnce('r');
		const result = await authService.getToken('1', 'password');
		expect(result).toEqual({access_token: 'a', refresh_token: 'r'});
	});

	it('getToken throws UnauthorizedException on bad password', async () => {
		userService.validatePassword.mockResolvedValueOnce(false);
		await expect(authService.getToken('1', 'wrong_password')).rejects.toBeInstanceOf(UnauthorizedException);
	});

	it('refreshToken issues new tokens when valid', async () => {
		const now = Math.floor(Date.now() / 1000);
		jwtService.verifyAsync.mockResolvedValue({
			type: 'refresh',
			sub: '1',
			username: 'Admin',
			role: UserRole.ADMIN,
			exp: now + 86400,
		} as any);
		jwtService.signAsync.mockResolvedValueOnce('a2');
		jwtService.signAsync.mockResolvedValueOnce('r2');
		const result = await authService.refreshToken('refresh');
		expect(result).toEqual({access_token: 'a2', refresh_token: 'r2'});
		// Verify old token was blacklisted (due to rotation)
		expect(tokenBlacklistRepository.save).toHaveBeenCalled();
	});

	it('revokeToken adds token to blacklist for valid refresh token', async () => {
		const now = Math.floor(Date.now() / 1000);
		jwtService.verifyAsync.mockResolvedValue({
			type: 'refresh',
			sub: '1',
			username: 'Admin',
			role: UserRole.ADMIN,
			exp: now + 86400,
		} as any);
		const ok = await authService.revokeToken('refresh');
		expect(ok).toBe(true);
		expect(tokenBlacklistRepository.save).toHaveBeenCalledWith(
			expect.objectContaining({
				user_id: '1',
				expires_at: now + 86400,
			}),
		);
	});

	it('validateAccessToken returns payload when valid', async () => {
		jwtService.verifyAsync.mockResolvedValue({type: 'access', sub: '1'} as any);
		const payload = await authService.validateAccessToken('access');
		expect(payload.sub).toBe('1');
	});

	describe('Token Blacklist Security', () => {
		it('should reject blacklisted refresh token', async () => {
			tokenBlacklistRepository.findOne.mockResolvedValueOnce({
				id: '1',
				token_hash: 'some-hash',
				user_id: '1',
				expires_at: Math.floor(Date.now() / 1000) + 3600,
				revoked_at: Math.floor(Date.now() / 1000),
			});

			await expect(authService.refreshToken('blacklisted-token')).rejects.toThrow('Token has been revoked');
		});

		it('should hash tokens before storing', async () => {
			const now = Math.floor(Date.now() / 1000);
			jwtService.verifyAsync.mockResolvedValue({
				type: 'refresh',
				sub: '1',
				exp: now + 86400,
			} as any);

			await authService.revokeToken('my-secret-token');

			expect(tokenBlacklistRepository.save).toHaveBeenCalledWith(
				expect.objectContaining({
					token_hash: expect.any(String),
					user_id: '1',
				}),
			);

			const saved_data = tokenBlacklistRepository.save.mock.calls[0][0];
			expect(saved_data.token_hash).not.toBe('my-secret-token');
			expect(saved_data.token_hash).toHaveLength(64); // SHA-256 produces 64 hex chars
		});

		it('should clean up expired tokens', async () => {
			tokenBlacklistRepository.delete.mockResolvedValue({affected: 3});

			const count = await authService.cleanupExpiredTokens();

			expect(count).toBe(3);
			expect(tokenBlacklistRepository.delete).toHaveBeenCalled();
		});

		it('should prevent token type confusion', async () => {
			jwtService.verifyAsync.mockResolvedValue({
				type: 'access', // Wrong type for revokeToken
				sub: '1',
			} as any);

			await expect(authService.revokeToken('access-token-used-as-refresh')).rejects.toThrow('Invalid token type');
		});

		it('should reject tokens for inactive users', async () => {
			const now = Math.floor(Date.now() / 1000);
			tokenBlacklistRepository.findOne.mockResolvedValue(null);
			jwtService.verifyAsync.mockResolvedValue({
				type: 'refresh',
				sub: '1',
				exp: now + 86400,
			} as any);
			userService.getUserById.mockResolvedValueOnce({
				id: '1',
				active: false, // User deactivated
			} as any);

			await expect(authService.refreshToken('valid-token')).rejects.toThrow('User account has been deactivated');
		});
	});

	/* *******************************************************
		Setup Key Validation
	******************************************************** */

	describe('validateSetupKey', () => {
		it('should return true when setup key matches server.setup_key', async () => {
			configService.get.mockReturnValue('my-setup-key');
			const result = await authService.validateSetupKey('my-setup-key');
			expect(result).toBe(true);
			expect(configService.get).toHaveBeenCalledWith('server.setup_key');
		});

		it('should return false when setup key does not match', async () => {
			configService.get.mockReturnValue('correct-key');
			const result = await authService.validateSetupKey('wrong-key');
			expect(result).toBe(false);
		});

		it('should throw UnauthorizedException when setup key is empty', async () => {
			await expect(authService.validateSetupKey('')).rejects.toBeInstanceOf(UnauthorizedException);
		});

		it('should return false when server has no setup key configured', async () => {
			configService.get.mockReturnValue(undefined);
			const result = await authService.validateSetupKey('any-key');
			expect(result).toBe(false);
		});
	});
});
