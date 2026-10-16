/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {CashuWalletMintService} from '#server/modules/cashu/wallet/mint/cashuwalletmint.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {ErrorService} from '#server/modules/error/error.service';
/* Local Dependencies */
import {OrchardEcashMint, OrchardEcashMintLookup, OrchardEcashMintStatus} from './ecashmint.model.js';

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

	/** Check whether the mints in a user's wallet are reachable: one when given, else all */
	async getEcashMintStatus(tag: string, user_id: string, mint_id: string | null = null): Promise<OrchardEcashMintStatus[]> {
		try {
			const statuses = await this.cashuWalletMintService.checkMints(user_id, mint_id);
			return statuses.map((status) => new OrchardEcashMintStatus(status));
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.EcashWalletError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	/** Look a mint up before adding it to a user's wallet; local addresses need allow_local */
	async lookupEcashMint(tag: string, user_id: string, mint_url: string, allow_local: boolean): Promise<OrchardEcashMintLookup> {
		try {
			return new OrchardEcashMintLookup(await this.cashuWalletMintService.lookupMint(user_id, mint_url, allow_local));
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.EcashWalletError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	/** Add a mint to a user's wallet; local addresses need allow_local */
	async addEcashMint(tag: string, user_id: string, mint_url: string, allow_local: boolean): Promise<OrchardEcashMint> {
		try {
			return new OrchardEcashMint(await this.cashuWalletMintService.addMint(user_id, mint_url, allow_local));
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
