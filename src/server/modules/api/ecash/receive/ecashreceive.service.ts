/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {CashuWalletSwapService} from '#server/modules/cashu/wallet/saga/swap/cashuwalletswap.service';
import {toWalletError} from '#server/modules/cashu/wallet/cashuwallet.helpers';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardEcashOperation} from '#server/modules/api/ecash/operation/ecashoperation.model';
/* Local Dependencies */
import {OrchardEcashTokenPreview} from './ecashreceive.model.js';

@Injectable()
export class EcashReceiveService {
	private readonly logger = new Logger(EcashReceiveService.name);

	constructor(
		private cashuWalletSwapService: CashuWalletSwapService,
		private errorService: ErrorService,
	) {}

	/** Read a token before a user receives it */
	async previewToken(tag: string, user_id: string, token: string, allow_local: boolean): Promise<OrchardEcashTokenPreview> {
		try {
			return new OrchardEcashTokenPreview(await this.cashuWalletSwapService.previewToken(user_id, token, allow_local));
		} catch (error) {
			throw this.handleError(tag, error);
		}
	}

	/** Receive a token into a user's wallet */
	async receiveToken(
		tag: string,
		user_id: string,
		token: string,
		add_mint: boolean,
		allow_local: boolean,
	): Promise<OrchardEcashOperation> {
		try {
			return new OrchardEcashOperation(await this.cashuWalletSwapService.receiveToken(user_id, token, add_mint, allow_local));
		} catch (error) {
			throw this.handleError(tag, error);
		}
	}

	/** A failed wallet call as an operator-readable wallet error */
	private handleError(tag: string, error: unknown): OrchardApiError {
		const orchard_error = this.errorService.resolveError(this.logger, toWalletError(error), tag, {
			errord: OrchardErrorCode.EcashWalletError,
		});
		return new OrchardApiError(orchard_error);
	}
}
