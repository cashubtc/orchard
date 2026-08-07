/* Core Dependencies */
import {Module} from '@nestjs/common';
/* Vendor Dependencies */
import {TypeOrmModule} from '@nestjs/typeorm';
/* Local Dependencies */
import {User} from './user.entity.js';
import {UserService} from './user.service.js';

@Module({
	imports: [TypeOrmModule.forFeature([User])],
	providers: [UserService],
	exports: [UserService],
})
export class UserModule {}
