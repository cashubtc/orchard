/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {CashuWalletSwapService} from '#server/modules/cashu/wallet/saga/swap/cashuwalletswap.service';
import {CashuWalletQuoteService} from '#server/modules/cashu/wallet/quote/cashuwalletquote.service';
import {CashuWalletWatchService} from '#server/modules/cashu/wallet/watch/cashuwalletwatch.service';
import {toWalletError} from '#server/modules/cashu/wallet/cashuwallet.helpers';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {watchStream} from '#server/modules/graphql/graphql.helpers';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardEcashOperation} from '#server/modules/api/ecash/operation/ecashoperation.model';
import type {CashuWalletQuoteRequest} from '#server/modules/cashu/wallet/cashuwallet.types';
/* Local Dependencies */
import {OrchardEcashQuote, OrchardEcashTokenPreview} from './ecashreceive.model.js';
import type {EcashQuoteWatchPayload} from './ecashreceive.types.js';

@Injectable()
export class EcashReceiveService {
	private readonly logger = new Logger(EcashReceiveService.name);

	constructor(
		private cashuWalletSwapService: CashuWalletSwapService,
		private cashuWalletQuoteService: CashuWalletQuoteService,
		private cashuWalletWatchService: CashuWalletWatchService,
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

	/** A payment request at one of a user's wallet mints */
	async newQuote(tag: string, request: CashuWalletQuoteRequest): Promise<OrchardEcashQuote> {
		try {
			return new OrchardEcashQuote(await this.cashuWalletQuoteService.newQuote(request));
		} catch (error) {
			throw this.handleError(tag, error);
		}
	}

	/** The bolt12 offer or onchain address a user's wallet receives on at a mint */
	async openQuote(tag: string, user_id: string, mint_id: string, method: string, unit: string): Promise<OrchardEcashQuote> {
		try {
			return new OrchardEcashQuote(await this.cashuWalletQuoteService.openQuote(user_id, mint_id, method, unit));
		} catch (error) {
			throw this.handleError(tag, error);
		}
	}

	/** A user's quote as it changes: the quote now, then each update until it takes no more payments or the stream is returned */
	async watchEcashQuote(
		tag: string,
		user_id: string,
		quote_id: string,
		updates: AsyncIterableIterator<EcashQuoteWatchPayload>,
	): Promise<AsyncIterableIterator<EcashQuoteWatchPayload>> {
		const start = async () => {
			const {quote, release} = await this.cashuWalletWatchService.watchQuote(user_id, quote_id);
			return {current: {ecash_quote_watch: new OrchardEcashQuote(quote)}, release};
		};
		try {
			return await watchStream(updates, start, ({ecash_quote_watch}) => ecash_quote_watch.final);
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
