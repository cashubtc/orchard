/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {CashuWalletSwapService} from '#server/modules/cashu/wallet/saga/swap/cashuwalletswap.service';
import {CashuWalletMintQuoteService} from '#server/modules/cashu/wallet/mintquote/cashuwalletmintquote.service';
import {CashuWalletWatchService} from '#server/modules/cashu/wallet/watch/cashuwalletwatch.service';
import {toWalletError} from '#server/modules/cashu/wallet/cashuwallet.helpers';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {watchStream} from '#server/modules/graphql/graphql.helpers';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardEcashOperation} from '#server/modules/api/ecash/operation/ecashoperation.model';
import type {CashuWalletMintQuoteRequest} from '#server/modules/cashu/wallet/cashuwallet.types';
/* Local Dependencies */
import {OrchardEcashMintQuote, OrchardEcashReceiveTokenPreview} from './ecashreceive.model.js';
import type {EcashMintQuoteWatchPayload} from './ecashreceive.types.js';

@Injectable()
export class EcashReceiveService {
	private readonly logger = new Logger(EcashReceiveService.name);

	constructor(
		private cashuWalletSwapService: CashuWalletSwapService,
		private cashuWalletMintQuoteService: CashuWalletMintQuoteService,
		private cashuWalletWatchService: CashuWalletWatchService,
		private errorService: ErrorService,
	) {}

	/** Read a token before a user receives it */
	async previewToken(tag: string, user_id: string, token: string, allow_local: boolean): Promise<OrchardEcashReceiveTokenPreview> {
		try {
			return new OrchardEcashReceiveTokenPreview(await this.cashuWalletSwapService.previewReceive(user_id, token, allow_local));
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

	/** A mint quote at one of a user's wallet mints */
	async newMintQuote(tag: string, request: CashuWalletMintQuoteRequest): Promise<OrchardEcashMintQuote> {
		try {
			return new OrchardEcashMintQuote(await this.cashuWalletMintQuoteService.newQuote(request));
		} catch (error) {
			throw this.handleError(tag, error);
		}
	}

	/** The bolt12 offer or onchain address a user's wallet receives on at a mint */
	async openMintQuote(tag: string, user_id: string, mint_id: string, method: string, unit: string): Promise<OrchardEcashMintQuote> {
		try {
			return new OrchardEcashMintQuote(await this.cashuWalletMintQuoteService.openQuote(user_id, mint_id, method, unit));
		} catch (error) {
			throw this.handleError(tag, error);
		}
	}

	/** A user's mint quote as it changes: the quote now, then each update until it takes no more payments or the stream is returned */
	async watchMintQuote(
		tag: string,
		user_id: string,
		quote_id: string,
		updates: AsyncIterableIterator<EcashMintQuoteWatchPayload>,
	): Promise<AsyncIterableIterator<EcashMintQuoteWatchPayload>> {
		const start = async () => {
			const {quote, release} = await this.cashuWalletWatchService.watchMintQuote(user_id, quote_id);
			return {current: {ecash_mint_quote_watch: new OrchardEcashMintQuote(quote)}, release};
		};
		try {
			return await watchStream(updates, start, ({ecash_mint_quote_watch}) => ecash_mint_quote_watch.final);
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
