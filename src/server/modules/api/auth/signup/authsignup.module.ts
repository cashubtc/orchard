/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {ErrorModule} from '#server/modules/error/error.module';
import {AuthModule} from '#server/modules/auth/auth.module';
import {UserModule} from '#server/modules/user/user.module';
import {InviteModule} from '#server/modules/invite/invite.module';
/* Internal Dependencies */
import {AuthSignupResolver} from './authsignup.resolver.js';
import {AuthSignupService} from './authsignup.service.js';

@Module({
	imports: [ErrorModule, AuthModule, UserModule, InviteModule],
	providers: [AuthSignupResolver, AuthSignupService],
})
export class AuthSignupModule {}
