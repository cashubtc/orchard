/* Core Dependencies */
import {Module} from '@nestjs/common';
import {JwtModule} from '@nestjs/jwt';
import {PassportModule} from '@nestjs/passport';
import {ConfigService} from '@nestjs/config';
/* Vendor Dependencies */
import {TypeOrmModule} from '@nestjs/typeorm';
/* Application Dependencies */
import {UserModule} from '#server/modules/user/user.module';
/* Local Dependencies */
import {AuthService} from './auth.service.js';
import {AuthStrategy} from './strategy/auth.strategy.js';
import {RefreshTokenStrategy} from './strategy/refresh.strategy.js';
import {TokenBlacklist} from './token-blacklist.entity.js';

@Module({
	imports: [
		PassportModule,
		UserModule,
		TypeOrmModule.forFeature([TokenBlacklist]),
		JwtModule.registerAsync({
			useFactory: async (configService: ConfigService) => ({
				secret: configService.get('server.jwt_secret'),
			}),
			inject: [ConfigService],
		}),
	],
	providers: [AuthService, AuthStrategy, RefreshTokenStrategy],
	exports: [AuthService],
})
export class AuthModule {}
