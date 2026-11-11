/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {CashuWalletSwapService} from '#server/modules/cashu/wallet/saga/swap/cashuwalletswap.service';
import {toWalletError} from '#server/modules/cashu/wallet/cashuwallet.helpers';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardEcashOperation} from '#server/modules/api/ecash/operation/ecashoperation.model';
import type {CashuWalletSendRequest} from '#server/modules/cashu/wallet/cashuwallet.types';

@Injectable()
export class EcashSendService {
	private readonly logger = new Logger(EcashSendService.name);

	constructor(
		private cashuWalletSwapService: CashuWalletSwapService,
		private errorService: ErrorService,
	) {}

	/** Send ecash from a user's wallet as a token */
	async sendToken(tag: string, request: CashuWalletSendRequest): Promise<OrchardEcashOperation> {
		try {
			return new OrchardEcashOperation(await this.cashuWalletSwapService.sendToken(request));
		} catch (error) {
			throw this.handleError(tag, error);
		}
	}

	/** Check whether a user's sent token was claimed */
	async checkToken(tag: string, user_id: string, operation_id: string): Promise<OrchardEcashOperation> {
		try {
			return new OrchardEcashOperation(await this.cashuWalletSwapService.checkToken(user_id, operation_id));
		} catch (error) {
			throw this.handleError(tag, error);
		}
	}

	/** Take back what's left unclaimed of a user's sent token */
	async reclaimToken(tag: string, user_id: string, operation_id: string): Promise<OrchardEcashOperation> {
		try {
			return new OrchardEcashOperation(await this.cashuWalletSwapService.reclaimToken(user_id, operation_id));
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
