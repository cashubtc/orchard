/* Core Dependencies */
import {Field, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';

@ObjectType({description: 'Entity genesis timestamp'})
export class OrchardCommonGenesis {
	@Field(() => UnixTimestamp, {description: 'Earliest recorded timestamp'})
	timestamp: number;

	constructor(timestamp: number) {
		this.timestamp = timestamp;
	}
}
