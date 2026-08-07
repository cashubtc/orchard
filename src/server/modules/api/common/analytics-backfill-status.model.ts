/* Core Dependencies */
import {Field, Int, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';
import {AnalyticsBackfillStatus} from '#server/modules/analytics/analytics.interfaces';

@ObjectType({description: 'Analytics backfill job status'})
export class OrchardAnalyticsBackfillStatus {
	@Field(() => Boolean, {description: 'Whether the backfill job is currently running'})
	is_running: boolean;

	@Field(() => UnixTimestamp, {nullable: true, description: 'Data timestamp of the first processed hour'})
	first_processed_at?: number;

	@Field(() => Int, {nullable: true, description: 'Number of errors encountered during backfill'})
	errors?: number;

	@Field(() => UnixTimestamp, {nullable: true, description: 'Timestamp of the last processed hour'})
	last_processed_at?: number;

	@Field(() => Int, {nullable: true, description: 'Total number of data streams in the backfill'})
	total_streams?: number;

	@Field(() => Int, {nullable: true, description: 'Number of data streams completed in the backfill'})
	streams_completed?: number;

	constructor(status: AnalyticsBackfillStatus) {
		this.is_running = status.is_running;
		this.first_processed_at = status.first_processed_at;
		this.errors = status.errors;
		this.last_processed_at = status.last_processed_at;
		this.total_streams = status.total_streams;
		this.streams_completed = status.streams_completed;
	}
}
