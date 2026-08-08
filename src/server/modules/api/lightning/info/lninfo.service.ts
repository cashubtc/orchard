/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
/* Application Dependencies */
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {ErrorService} from '#server/modules/error/error.service';
import {LightningService} from '#server/modules/lightning/lightning/lightning.service';
import type {LightningInfo} from '#server/modules/lightning/lightning/lightning.types';
import {CashuMintDatabaseService} from '#server/modules/cashu/mintdb/cashumintdb.service';
import {MintService} from '#server/modules/api/mint/mint.service';
/* Local Dependencies */
import {OrchardLightningInfo} from './lninfo.model.js';

@Injectable()
export class LightningInfoService {
	private readonly logger = new Logger(LightningInfoService.name);

	constructor(
		private lightningService: LightningService,
		private cashuMintDatabaseService: CashuMintDatabaseService,
		private mintService: MintService,
		private configService: ConfigService,
		private errorService: ErrorService,
	) {}

	async getLightningInfo(tag: string): Promise<OrchardLightningInfo> {
		try {
			const lightning_info: LightningInfo = await this.lightningService.getLightningInfo();
			const backend = await this.determineMintBackend(lightning_info.identity_pubkey);
			return new OrchardLightningInfo(lightning_info, backend);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.LightningRpcActionError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	/**
	 * Determines if this lightning node is the backend for the configured cashu mint
	 * Checks the most recent lightning mint quote's decoded destination against the node's
	 * pubkey. Onchain quotes are skipped (their request is a bitcoin address); bolt12 offers
	 * decode on CLN via the offer_issuer_id fallback and fail closed on bolt11-only nodes.
	 */
	private async determineMintBackend(identity_pubkey: string): Promise<boolean> {
		try {
			if (!this.configService.get('cashu.type') || !this.configService.get('cashu.database')) return false;
			return await this.mintService.withDbClient(async (client) => {
				const quotes = await this.cashuMintDatabaseService.listMintQuotes(client, {page_size: 10, page: 1});
				const quote = quotes?.find((q) => q.payment_method === 'bolt11' || q.payment_method === 'bolt12');
				if (!quote?.request) return false;
				const decoded = await this.lightningService.getLightningRequest(quote.request);
				return decoded?.destination === identity_pubkey;
			});
		} catch {
			return false;
		}
	}
}
