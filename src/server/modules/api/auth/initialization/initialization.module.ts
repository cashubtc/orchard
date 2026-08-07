/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {ErrorModule} from '#server/modules/error/error.module';
import {AuthModule} from '#server/modules/auth/auth.module';
import {UserModule} from '#server/modules/user/user.module';
/* Internal Dependencies */
import {AuthInitializationResolver} from './initialization.resolver.js';
import {AuthInitializationService} from './initialization.service.js';

@Module({
	imports: [ErrorModule, AuthModule, UserModule],
	providers: [AuthInitializationResolver, AuthInitializationService],
})
export class AuthInitializationModule {}
