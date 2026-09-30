/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {CashuWalletSeedService} from '#server/modules/cashu/wallet/seed/cashuwalletseed.service';
import {UserService} from '#server/modules/user/user.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {ErrorService} from '#server/modules/error/error.service';
/* Local Dependencies */
import {OrchardEcashSeed} from './ecashseed.model.js';

@Injectable()
export class EcashSeedService {
	private readonly logger = new Logger(EcashSeedService.name);

	constructor(
		private cashuWalletSeedService: CashuWalletSeedService,
		private userService: UserService,
		private errorService: ErrorService,
	) {}

	/** Backup status of a user's wallet seed, null before the wallet is first used */
	async getEcashSeed(tag: string, user_id: string): Promise<OrchardEcashSeed | null> {
		try {
			const seed = await this.cashuWalletSeedService.getSeedStatus(user_id);
			return seed ? new OrchardEcashSeed(seed) : null;
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.EcashWalletError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	/** Reveal a user's mnemonic once their password checks out */
	async revealEcashSeed(tag: string, user_id: string, password: string): Promise<string> {
		try {
			const user = await this.userService.getUserById(user_id);
			if (!user) throw OrchardErrorCode.UserError;
			if (!(await this.userService.validatePassword(user, password))) throw OrchardErrorCode.InvalidPasswordError;
			return await this.cashuWalletSeedService.getMnemonic(user_id);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.EcashWalletError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	/** Record that a user backed up their mnemonic */
	async backupEcashSeed(tag: string, user_id: string): Promise<OrchardEcashSeed> {
		try {
			return new OrchardEcashSeed(await this.cashuWalletSeedService.markBackedUp(user_id));
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.EcashWalletError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}
}
