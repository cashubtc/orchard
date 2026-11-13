/* Core Dependencies */
import {Module} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {ServeStaticModule} from '@nestjs/serve-static';
import * as path from 'path';

@Module({
	imports: [
		ServeStaticModule.forRootAsync({
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => [
				{
					rootPath: path.join(process.env.ASSETS_DIR || process.cwd(), 'dist', 'client', 'browser'),
					exclude: [`/${configService.get('server.path')}`],
				},
			],
		}),
	],
})
export class WebserverModule {}
