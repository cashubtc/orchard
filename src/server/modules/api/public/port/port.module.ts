/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Local Dependencies */
import {PublicPortService} from './port.service.js';
import {PublicPortResolver} from './port.resolver.js';

@Module({
	providers: [PublicPortResolver, PublicPortService],
})
export class PublicPortModule {}
