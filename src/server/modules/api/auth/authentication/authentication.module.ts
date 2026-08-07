/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {ErrorModule} from '@server/modules/error/error.module';
import {AuthModule} from '@server/modules/auth/auth.module';
import {UserModule} from '@server/modules/user/user.module';
/* Internal Dependencies */
import {AuthAuthenticationResolver} from './authentication.resolver.js';
import {AuthAuthenticationService} from './authentication.service.js';

@Module({
	imports: [ErrorModule, AuthModule, UserModule],
	providers: [AuthAuthenticationResolver, AuthAuthenticationService],
})
export class AuthAuthenticationModule {}
