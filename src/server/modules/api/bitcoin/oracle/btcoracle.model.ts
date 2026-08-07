/* Core Dependencies */
import {Field, Float, Int, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';
import {UTXOracle} from '#server/modules/bitcoin/utxoracle/utxoracle.entity';
import {UTXOracleProgressStatus} from '#server/modules/bitcoin/utxoracle/utxoracle.enums';

@ObjectType({description: 'Bitcoin oracle price data point'})
export class OrchardBitcoinOraclePrice {
	@Field(() => UnixTimestamp, {description: 'Date of the price data point'})
	date: number;

	@Field(() => Float, {description: 'Bitcoin price in USD'})
	price: number;

	constructor(data: UTXOracle) {
		this.date = data.date;
		this.price = data.price;
	}
}

@ObjectType({description: 'Bitcoin oracle backfill stream reference'})
export class OrchardBitcoinOracleBackfillStream {
	@Field(() => String, {description: 'Unique backfill stream identifier'})
	id: string;
}

@ObjectType({description: 'Bitcoin oracle backfill progress status'})
export class OrchardBitcoinOracleBackfillProgress {
	@Field(() => String, {description: 'Unique backfill stream identifier'})
	id: string;

	@Field(() => UTXOracleProgressStatus, {description: 'Current status of the backfill process'})
	status: UTXOracleProgressStatus;

	@Field(() => UnixTimestamp, {nullable: true, description: 'Start date of the backfill range'})
	start_date?: number;

	@Field(() => UnixTimestamp, {nullable: true, description: 'End date of the backfill range'})
	end_date?: number;

	@Field(() => UnixTimestamp, {nullable: true, description: 'Date currently being processed'})
	date?: number;

	@Field(() => Int, {nullable: true, description: 'Price retrieved for the current date'})
	price?: number;

	@Field(() => Boolean, {nullable: true, description: 'Whether the current date was processed successfully'})
	success?: boolean;

	@Field(() => String, {nullable: true, description: 'Error message if processing failed'})
	error?: string;

	@Field(() => Int, {nullable: true, description: 'Total number of days in the backfill range'})
	total_days?: number;

	@Field(() => Int, {nullable: true, description: 'Number of days processed so far'})
	processed?: number;

	@Field(() => Int, {nullable: true, description: 'Number of days processed successfully'})
	successful?: number;

	@Field(() => Int, {nullable: true, description: 'Number of days that failed processing'})
	failed?: number;

	@Field(() => Float, {nullable: true, description: 'Progress percentage for the current date (0-100)'})
	date_progress?: number; // 0-100

	@Field(() => Float, {nullable: true, description: 'Overall backfill progress percentage (0-100)'})
	overall_progress?: number; // 0-100

	@Field(() => String, {nullable: true, description: 'Human-readable progress message'})
	message?: string;

	constructor(data: Partial<OrchardBitcoinOracleBackfillProgress>) {
		Object.assign(this, data);
	}
}
