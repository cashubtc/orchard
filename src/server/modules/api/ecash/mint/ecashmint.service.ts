/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {CashuWalletMintService} from '#server/modules/cashu/wallet/cashuwalletmint.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {ErrorService} from '#server/modules/error/error.service';
/* Local Dependencies */
import {OrchardEcashMint} from './ecashmint.model.js';

@Injectable()
export class EcashMintService {
	private readonly logger = new Logger(EcashMintService.name);

	constructor(
		private cashuWalletMintService: CashuWalletMintService,
		private errorService: ErrorService,
	) {}

	/** List a user's wallet mints */
	async getEcashMints(tag: string, user_id: string): Promise<OrchardEcashMint[]> {
		try {
			const mints = await this.cashuWalletMintService.listMints(user_id);
			return mints.map((mint) => new OrchardEcashMint(mint));
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.EcashWalletError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	/** Add a mint to a user's wallet */
	async addEcashMint(tag: string, user_id: string, mint_url: string): Promise<OrchardEcashMint> {
		try {
			return new OrchardEcashMint(await this.cashuWalletMintService.addMint(user_id, mint_url));
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.EcashWalletError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	/** Remove a mint from a user's wallet */
	async removeEcashMint(tag: string, user_id: string, mint_id: string): Promise<boolean> {
		try {
			await this.cashuWalletMintService.removeMint(user_id, mint_id);
			return true;
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.EcashWalletError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}
}
