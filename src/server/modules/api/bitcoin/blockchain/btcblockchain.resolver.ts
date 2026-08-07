/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Subscription, Query} from '@nestjs/graphql';
// import {OnModuleInit, OnModuleDestroy} from '@nestjs/common';
/* Vendor Dependencies */
import {PubSub} from 'graphql-subscriptions';
/* Local Dependencies */
import {BitcoinBlockchainService} from './btcblockchain.service.js';
import {OrchardBitcoinBlockCount, OrchardBitcoinBlockchainInfo} from './btcblockchain.model.js';

const pubSub = new PubSub();

@Resolver(() => OrchardBitcoinBlockCount)
export class BitcoinBlockchainResolver {
	private readonly logger = new Logger(BitcoinBlockchainResolver.name);

	constructor(private bitcoinBlockchainService: BitcoinBlockchainService) {}

	// onModuleInit() {
	// 	if (process.env.SCHEMA_ONLY) return;
	// 	this.bitcoinBlockCountService.startBlockCountPolling();
	// 	this.bitcoinBlockCountService.onBlockCountUpdate((block_count) => {
	// 		this.logger.debug(`New Block Found!: ${block_count}`);
	// 		pubSub.publish('bitcoin.blockcount', { blockCount: { block_count } });
	// 	});
	// }

	// onModuleDestroy() {
	// 	this.bitcoinBlockCountService.stopBlockCountPolling();
	// }

	@Query(() => OrchardBitcoinBlockCount, {description: 'Get the current Bitcoin block count'})
	async bitcoin_blockcount(): Promise<OrchardBitcoinBlockCount> {
		const tag = 'GET { bitcoin_blockcount }';
		this.logger.debug(tag);
		return await this.bitcoinBlockchainService.getBlockCount(tag);
	}

	@Subscription(() => OrchardBitcoinBlockCount, {
		name: 'blockCount',
		resolve: (value) => value.blockCount,
		description: 'Subscribe to new Bitcoin block notifications',
	})
	subscribeToBlockCount() {
		this.logger.debug('SUBSCRIPTION { bitcoin.blockcount }');
		return pubSub.asyncIterableIterator('bitcoin.blockcount');
	}

	@Query(() => OrchardBitcoinBlockchainInfo, {description: 'Get Bitcoin blockchain information'})
	async bitcoin_blockchain_info(): Promise<OrchardBitcoinBlockchainInfo> {
		const tag = 'GET { bitcoin_blockchain_info }';
		this.logger.debug(tag);
		return await this.bitcoinBlockchainService.getBlockchainInfo(tag);
	}
}
