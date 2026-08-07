/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query} from '@nestjs/graphql';
/* Local Dependencies */
import {TaprootAssetsAssetService} from './tapasset.service.js';
import {OrchardTaprootAssets, OrchardTaprootAssetsUtxo} from './tapasset.model.js';

@Resolver()
export class TaprootAssetsAssetResolver {
	private readonly logger = new Logger(TaprootAssetsAssetResolver.name);

	constructor(private taprootAssetsAssetService: TaprootAssetsAssetService) {}

	@Query(() => OrchardTaprootAssets, {description: 'Get all Taproot assets'})
	async taproot_assets(): Promise<OrchardTaprootAssets> {
		const tag = 'GET { taproot_assets }';
		this.logger.debug(tag);
		return await this.taprootAssetsAssetService.getTaprootAssets(tag);
	}

	@Query(() => [OrchardTaprootAssetsUtxo], {description: 'Get all Taproot asset UTXOs'})
	async taproot_assets_utxo(): Promise<OrchardTaprootAssetsUtxo[]> {
		const tag = 'GET { taproot_assets_utxo }';
		this.logger.debug(tag);
		return await this.taprootAssetsAssetService.getTaprootAssetsUtxo(tag);
	}
}
