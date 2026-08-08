/* Core Dependencies */
import {Injectable} from '@nestjs/common';
import {PassportStrategy} from '@nestjs/passport';
import {ConfigService} from '@nestjs/config';
/* Vendor Dependencies */
import {ExtractJwt, Strategy} from 'passport-jwt';
/* Native Dependencies */
import type {RefreshTokenPayload} from '#server/modules/auth/auth.types';

@Injectable()
export class RefreshTokenStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
	constructor(private readonly configService: ConfigService) {
		super({
			jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
			ignoreExpiration: false,
			secretOrKey: configService.get('server.jwt_secret'),
			passReqToCallback: true,
		});
	}

	async validate(req: any, payload: RefreshTokenPayload) {
		const refresh_token = req.get('Authorization').replace('Bearer', '').trim();
		return {
			id: payload.sub,
			name: payload.username,
			refresh_token,
		};
	}
}
