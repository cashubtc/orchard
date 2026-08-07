/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {ErrorService} from '#server/modules/error/error.service';
import {TaprootAssetsService} from '#server/modules/tapass/tapass/tapass.service';
import {TaprootAssetsUtxos, TaprootAssets} from '#server/modules/tapass/tapass/tapass.types';
/* Local Dependencies */
import {OrchardTaprootAssets, OrchardTaprootAssetsUtxo} from './tapasset.model.js';

@Injectable()
export class TaprootAssetsAssetService {
	private readonly logger = new Logger(TaprootAssetsAssetService.name);

	constructor(
		private taprootAssetsService: TaprootAssetsService,
		private errorService: ErrorService,
	) {}

	async getTaprootAssets(tag: string): Promise<OrchardTaprootAssets> {
		try {
			const ta_assets: TaprootAssets = await this.taprootAssetsService.getListTaprootAssets();
			return new OrchardTaprootAssets(ta_assets);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.TaprootAssetsRpcActionError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	async getTaprootAssetsUtxo(tag: string): Promise<OrchardTaprootAssetsUtxo[]> {
		try {
			const ta_utxos: TaprootAssetsUtxos = await this.taprootAssetsService.getListTaprootAssetsUtxos();
			return Object.entries(ta_utxos.managed_utxos).map(([key, utxo]) => new OrchardTaprootAssetsUtxo(utxo, key));
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.TaprootAssetsRpcActionError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}
}
