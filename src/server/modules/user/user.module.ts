/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Vendor Dependencies */
import {TypeOrmModule} from '@nestjs/typeorm';
/* Local Dependencies */
import {User} from './user.entity.js';
import {UserSession} from './user-session.entity.js';
import {UserService} from './user.service.js';
import {UserSessionService} from './user-session.service.js';

@Module({
	imports: [TypeOrmModule.forFeature([User, UserSession])],
	providers: [UserService, UserSessionService],
	exports: [UserService, UserSessionService],
})
export class UserModule {}
