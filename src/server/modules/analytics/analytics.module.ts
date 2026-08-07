/* Core Dependencies */
import {Module} from '@nestjs/common';
import {TypeOrmModule} from '@nestjs/typeorm';
/* Local Dependencies */
import {AnalyticsCheckpoint} from './analytics-checkpoint.entity.js';

/**
 * Shared analytics module providing common entities and utilities
 * for analytics tracking across different modules (lightning, mint, etc.)
 */
@Module({
	imports: [TypeOrmModule.forFeature([AnalyticsCheckpoint])],
	exports: [TypeOrmModule],
})
export class AnalyticsModule {}
