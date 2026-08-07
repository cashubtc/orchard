/* Core Dependencies */
import {Logger, OnModuleInit} from '@nestjs/common';
import {Resolver, Query, Subscription, Args, Mutation} from '@nestjs/graphql';
import {Throttle, minutes} from '@nestjs/throttler';
/* Vendor Dependencies */
import {PubSub} from 'graphql-subscriptions';
/* Application Dependencies */
import {Roles} from '@server/modules/auth/decorators/auth.decorator';
import {UserRole} from '@server/modules/user/user.enums';
import {UnixTimestamp} from '@server/modules/graphql/scalars/unixtimestamp.scalar';
/* Local Dependencies */
import {OrchardBitcoinOraclePrice, OrchardBitcoinOracleBackfillProgress, OrchardBitcoinOracleBackfillStream} from './btcoracle.model.js';
import {BitcoinOracleService} from './btcoracle.service.js';

const pubSub = new PubSub();

@Resolver()
export class BitcoinOracleResolver implements OnModuleInit {
	private readonly logger = new Logger(BitcoinOracleResolver.name);

	constructor(private bitcoinOracleService: BitcoinOracleService) {}

	onModuleInit() {
		if (process.env.SCHEMA_ONLY) return;
		this.bitcoinOracleService.onBackfillUpdate((update: OrchardBitcoinOracleBackfillProgress) => {
			pubSub.publish('bitcoin_oracle_backfill', {bitcoin_oracle_backfill: update});
		});
	}

	@Query(() => [OrchardBitcoinOraclePrice], {description: 'Get Bitcoin oracle price history'})
	async bitcoin_oracle(
		@Args('start_date', {type: () => UnixTimestamp, nullable: true, description: 'Start date filter for price history'})
		start_date?: number,
		@Args('end_date', {type: () => UnixTimestamp, nullable: true, description: 'End date filter for price history'}) end_date?: number,
	): Promise<OrchardBitcoinOraclePrice[]> {
		const tag = 'GET { bitcoin_oracle }';
		this.logger.debug(tag);
		return await this.bitcoinOracleService.getOracle(tag, start_date, end_date);
	}

	@Subscription(() => OrchardBitcoinOracleBackfillProgress, {description: 'Subscribe to Bitcoin oracle backfill progress updates'})
	@Throttle({default: {limit: 3, ttl: minutes(1)}})
	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	async bitcoin_oracle_backfill(
		@Args('id', {type: () => String, description: 'Unique backfill stream identifier'}) id: string,
		@Args('start_date', {type: () => UnixTimestamp, description: 'Start date for the backfill range'}) start_date: number,
		@Args('end_date', {type: () => UnixTimestamp, nullable: true, description: 'End date for the backfill range'}) end_date?: number,
	) {
		const tag = `SUBSCRIPTION { bitcoin_oracle_backfill } stream ${id}`;
		this.logger.debug(tag);
		this.bitcoinOracleService.streamBackfillOracle(tag, id, start_date, end_date);
		return pubSub.asyncIterableIterator('bitcoin_oracle_backfill');
	}

	@Mutation(() => OrchardBitcoinOracleBackfillStream, {description: 'Abort a Bitcoin oracle backfill stream'})
	@Roles(UserRole.ADMIN)
	async bitcoin_oracle_backfill_abort(
		@Args('id', {type: () => String, description: 'Backfill stream identifier to abort'}) id: string,
	): Promise<OrchardBitcoinOracleBackfillStream> {
		const tag = `MUTATION { bitcoin_oracle_backfill_abort } for stream ${id}`;
		this.logger.debug(tag);
		return this.bitcoinOracleService.abortBackfillStream(id);
	}
}
