/* Core Dependencies */
import {Injectable, UnauthorizedException} from '@nestjs/common';
import {PassportStrategy} from '@nestjs/passport';
import {ConfigService} from '@nestjs/config';
/* Vendor Dependencies */
import {ExtractJwt, Strategy} from 'passport-jwt';
/* Native Dependencies */
import {JwtPayload} from '@server/modules/auth/auth.types';

@Injectable()
export class AuthStrategy extends PassportStrategy(Strategy) {
	constructor(private readonly configService: ConfigService) {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
			secretOrKey: configService.get('server.jwt_secret'),
			passReqToCallback: true,
		});
	}

	/**
	 * Maps a verified JWT payload to the request user
	 * Rejects refresh tokens so they cannot be used as long-lived bearer credentials
	 * (revocation via the blacklist only applies to the refresh flow)
	 * @param {any} req - The incoming HTTP request
	 * @param {JwtPayload} payload - The verified JWT payload
	 * @returns {object} The authenticated user attached to the request context
	 */
	async validate(req: any, payload: JwtPayload) {
		if (payload.type !== 'access') throw new UnauthorizedException('Invalid token type. Access token required');
		const auth_token = req.get('Authorization').replace('Bearer', '').trim();
		return {
			id: payload.sub,
			name: payload.username,
			role: payload.role,
			auth_token,
		};
	}
}
