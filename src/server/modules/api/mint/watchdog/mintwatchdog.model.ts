/* Core Dependencies */
import {Field, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '@server/modules/graphql/scalars/unixtimestamp.scalar';

@ObjectType({description: 'Liveness of the nutshell balance_log watchdog'})
export class OrchardMintWatchdogStatus {
	@Field(() => Boolean, {description: 'True when balance_log has a row written within the freshness window'})
	is_alive: boolean;

	@Field(() => UnixTimestamp, {nullable: true, description: 'Timestamp of the most recent balance_log row, null when the table is empty'})
	last_seen: number | null;

	constructor(is_alive: boolean, last_seen: number | null) {
		this.is_alive = is_alive;
		this.last_seen = last_seen;
	}
}
