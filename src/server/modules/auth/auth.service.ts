/* Core Dependencies */
import {Injectable, UnauthorizedException, Logger} from '@nestjs/common';
import {JwtService} from '@nestjs/jwt';
import {ConfigService} from '@nestjs/config';
import * as crypto from 'crypto';
/* Vendor Dependencies */
import {InjectRepository} from '@nestjs/typeorm';
import {Repository, LessThan} from 'typeorm';
import {DateTime} from 'luxon';
/* Application Dependencies */
import {UserService} from '@server/modules/user/user.service';
/* Local Dependencies */
import {OrchardAuthToken, JwtPayload, RefreshTokenPayload} from './auth.types.js';
import {TokenBlacklist} from './token-blacklist.entity.js';

@Injectable()
export class AuthService {
	private readonly logger = new Logger(AuthService.name);

	private token_ttl = 15 * 60;
	private refresh_ttl = 7 * 24 * 60 * 60;

	constructor(
		private configService: ConfigService,
		private jwtService: JwtService,
		private userService: UserService,
		@InjectRepository(TokenBlacklist)
		private tokenBlacklistRepository: Repository<TokenBlacklist>,
	) {}

	/**
	 * Hash a token for secure storage
	 * @param {string} token - JWT token to hash
	 * @returns {string} SHA-256 hash of the token
	 */
	private hashToken(token: string): string {
		return crypto.createHash('sha256').update(token).digest('hex');
	}

	/**
	 * Check if a token is blacklisted
	 * @param {string} token - JWT token to check
	 * @returns {Promise<boolean>} true if token is blacklisted
	 */
	private async isTokenBlacklisted(token: string): Promise<boolean> {
		const token_hash = this.hashToken(token);
		const blacklisted = await this.tokenBlacklistRepository.findOne({
			where: {token_hash},
		});
		return !!blacklisted;
	}

	public async getToken(id: string, password: string): Promise<OrchardAuthToken> {
		const user = await this.userService.getUserById(id);
		if (!user) throw new UnauthorizedException('Invalid user');
		if (!user.active) throw new UnauthorizedException('User account has been deactivated');
		const valid = await this.userService.validatePassword(user, password);
		if (!valid) throw new UnauthorizedException('Invalid username or password');
		const access_payload: JwtPayload = {
			sub: id,
			username: user.name,
			role: user.role,
			type: 'access',
		};
		const refresh_payload: RefreshTokenPayload = {
			sub: user.id,
			username: user.name,
			role: user.role,
			type: 'refresh',
		};
		const [access_token, refresh_token] = await Promise.all([
			this.jwtService.signAsync(access_payload, {expiresIn: this.token_ttl}),
			this.jwtService.signAsync(refresh_payload, {expiresIn: this.refresh_ttl}),
		]);

		return {
			access_token,
			refresh_token,
		};
	}

	public async refreshToken(refresh_token: string): Promise<OrchardAuthToken> {
		try {
			if (await this.isTokenBlacklisted(refresh_token)) throw new UnauthorizedException('Token has been revoked');
			const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refresh_token);
			if (payload.type !== 'refresh') throw new UnauthorizedException('Invalid token type');
			const user = await this.userService.getUserById(payload.sub);
			if (!user) throw new UnauthorizedException('Invalid user');
			if (!user.active) throw new UnauthorizedException('User account has been deactivated');
			await this.revokeToken(refresh_token);
			const access_payload: JwtPayload = {
				sub: user.id,
				username: user.name,
				role: user.role,
				type: 'access',
			};
			const refresh_payload: RefreshTokenPayload = {
				sub: user.id,
				username: user.name,
				role: user.role,
				type: 'refresh',
			};
			const [new_access_token, new_refresh_token] = await Promise.all([
				this.jwtService.signAsync(access_payload, {expiresIn: this.token_ttl}),
				this.jwtService.signAsync(refresh_payload, {expiresIn: this.refresh_ttl}),
			]);
			return {
				access_token: new_access_token,
				refresh_token: new_refresh_token,
			};
		} catch (error) {
			this.logger.debug(`Error refreshing token: ${error.message}`);
			if (error instanceof UnauthorizedException) throw error;
			throw new UnauthorizedException('Invalid refresh token');
		}
	}

	public async revokeToken(refresh_token: string): Promise<boolean> {
		try {
			const payload = await this.jwtService.verifyAsync<RefreshTokenPayload>(refresh_token);
			if (payload.type !== 'refresh') throw new UnauthorizedException('Invalid token type');
			const token_hash = this.hashToken(refresh_token);
			const now = Math.floor(DateTime.now().toSeconds());

			await this.tokenBlacklistRepository.save({
				token_hash,
				user_id: payload.sub,
				expires_at: payload.exp,
				revoked_at: now,
			});

			return true;
		} catch (error) {
			this.logger.debug(`Error revoking token: ${error.message}`);
			if (error instanceof UnauthorizedException) throw error;
			throw new UnauthorizedException('Invalid refresh token');
		}
	}

	/**
	 * Clean up expired tokens from blacklist (call periodically via cron)
	 * @returns {Promise<number>} number of tokens removed
	 */
	public async cleanupExpiredTokens(): Promise<number> {
		const now = Math.floor(DateTime.now().toSeconds());
		const result = await this.tokenBlacklistRepository.delete({
			expires_at: LessThan(now),
		});
		return result.affected || 0;
	}

	public async validateSetupKey(setup_key: string): Promise<boolean> {
		if (!setup_key) throw new UnauthorizedException('No setup key provided');
		const key = this.configService.get('server.setup_key');
		if (setup_key !== key) return false;
		return true;
	}

	public async validateAccessToken(access_token: string): Promise<JwtPayload> {
		if (!access_token) throw new UnauthorizedException('No access token provided');
		try {
			const payload = await this.jwtService.verifyAsync<JwtPayload>(access_token);
			if (payload.type !== 'access') throw new UnauthorizedException('Invalid token type - access token required');
			return payload;
		} catch (error) {
			this.logger.debug(`Error validating access token: ${error.message}`);
			if (error instanceof UnauthorizedException) throw error;
			throw new UnauthorizedException('Invalid access token');
		}
	}

	public async getInitialization(): Promise<boolean> {
		const user_count = await this.userService.getUserCount();
		return user_count !== 0;
	}
}
