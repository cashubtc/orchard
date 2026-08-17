/* Core Dependencies */
import {Field, Float, Int, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';

@ObjectType({description: 'Cashu mint activity time bucket'})
export class OrchardMintActivityBucket {
	@Field(() => UnixTimestamp, {description: 'Timestamp for the bucket period'})
	created_time: number;

	@Field(() => Float, {description: 'Aggregated amount for the bucket period'})
	amount: number;
}

@ObjectType({description: 'Cashu mint activity summary with trends'})
export class OrchardMintActivitySummary {
	@Field(() => Int, {description: 'Total number of operations in the period'})
	total_operations: number;

	@Field(() => Float, {description: 'Percentage change in total operations from previous period'})
	total_operations_delta: number;

	@Field(() => Float, {description: 'Total volume across all operations'})
	total_volume: number;

	@Field(() => Float, {description: 'Percentage change in total volume from previous period'})
	total_volume_delta: number;

	@Field(() => Int, {description: 'Number of mint operations in the period'})
	mint_count: number;

	@Field(() => Float, {description: 'Percentage change in mint count from previous period'})
	mint_count_delta: number;

	@Field(() => [OrchardMintActivityBucket], {description: 'Sparkline data for mint operations over time'})
	mint_sparkline: OrchardMintActivityBucket[];

	@Field(() => Int, {description: 'Number of melt operations in the period'})
	melt_count: number;

	@Field(() => Float, {description: 'Percentage change in melt count from previous period'})
	melt_count_delta: number;

	@Field(() => [OrchardMintActivityBucket], {description: 'Sparkline data for melt operations over time'})
	melt_sparkline: OrchardMintActivityBucket[];

	@Field(() => Int, {description: 'Number of swap operations in the period'})
	swap_count: number;

	@Field(() => Float, {description: 'Percentage change in swap count from previous period'})
	swap_count_delta: number;

	@Field(() => [OrchardMintActivityBucket], {description: 'Sparkline data for swap operations over time'})
	swap_sparkline: OrchardMintActivityBucket[];

	@Field(() => Float, {description: 'Percentage of mint operations completed successfully'})
	mint_completed_pct: number;

	@Field(() => Float, {description: 'Percentage change in mint completion rate from previous period'})
	mint_completed_pct_delta: number;

	@Field(() => Float, {description: 'Average time to complete a mint operation in seconds'})
	mint_avg_time: number;

	@Field(() => Float, {description: 'Percentage change in mint average time from previous period'})
	mint_avg_time_delta: number;

	@Field(() => Float, {description: 'Percentage of melt operations completed successfully'})
	melt_completed_pct: number;

	@Field(() => Float, {description: 'Percentage change in melt completion rate from previous period'})
	melt_completed_pct_delta: number;

	@Field(() => Float, {description: 'Average time to complete a melt operation in seconds'})
	melt_avg_time: number;

	@Field(() => Float, {description: 'Percentage change in melt average time from previous period'})
	melt_avg_time_delta: number;

	@Field(() => [String], {description: 'Warning messages about data quality or completeness'})
	warnings: string[];
}
