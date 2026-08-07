/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query} from '@nestjs/graphql';
/* Local Dependencies */
import {OrchardBitcoinNetworkInfo} from './btcnetwork.model.js';
import {BitcoinNetworkService} from './btcnetwork.service.js';

@Resolver()
export class BitcoinNetworkResolver {
	private readonly logger = new Logger(BitcoinNetworkResolver.name);

	constructor(private bitcoinNetworkService: BitcoinNetworkService) {}

	@Query(() => OrchardBitcoinNetworkInfo, {description: 'Get Bitcoin network information'})
	async bitcoin_network_info(): Promise<OrchardBitcoinNetworkInfo> {
		const tag = 'GET { bitcoin_network_info }';
		this.logger.debug(tag);
		return await this.bitcoinNetworkService.getBitcoinNetworkInfo(tag);
	}
}
