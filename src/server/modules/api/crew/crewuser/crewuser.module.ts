/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Application Dependencies */
import {ErrorModule} from '#server/modules/error/error.module';
import {UserModule} from '#server/modules/user/user.module';
/* Local Dependencies */
import {CrewUserService} from './crewuser.service.js';
import {CrewUserResolver} from './crewuser.resolver.js';

@Module({
	imports: [ErrorModule, UserModule],
	providers: [CrewUserResolver, CrewUserService],
})
export class CrewUserModule {}
