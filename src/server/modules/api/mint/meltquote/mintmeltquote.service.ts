/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {CashuMintDatabaseService} from '#server/modules/cashu/mintdb/cashumintdb.service';
import {CashuMintRpcService} from '#server/modules/cashu/mintrpc/cashumintrpc.service';
import {CashuMintMeltQuote} from '#server/modules/cashu/mintdb/cashumintdb.types';
import {CashuMintMeltQuotesArgs} from '#server/modules/cashu/mintdb/cashumintdb.interfaces';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {MintService} from '#server/modules/api/mint/mint.service';
import {ErrorService} from '#server/modules/error/error.service';
/* Local Dependencies */
import {OrchardMintMeltQuote, OrchardMintNut05Update, OrchardMintNut05QuoteUpdate} from './mintmeltquote.model.js';

@Injectable()
export class MintMeltQuoteService {
	private readonly logger = new Logger(MintMeltQuoteService.name);

	constructor(
		private cashuMintDatabaseService: CashuMintDatabaseService,
		private cashuMintRpcService: CashuMintRpcService,
		private mintService: MintService,
		private errorService: ErrorService,
	) {}

	async getMintMeltQuotes(tag: string, args?: CashuMintMeltQuotesArgs): Promise<OrchardMintMeltQuote[]> {
		return this.mintService.withDbClient(async (client) => {
			try {
				const cashu_melt_quotes: CashuMintMeltQuote[] = await this.cashuMintDatabaseService.listMeltQuotes(client, args);
				return cashu_melt_quotes.map((cmq) => new OrchardMintMeltQuote(cmq));
			} catch (error) {
				const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
					errord: OrchardErrorCode.MintDatabaseSelectError,
				});
				throw new OrchardApiError(orchard_error);
			}
		});
	}

	async updateMintNut05(
		tag: string,
		unit: string,
		method: string,
		disabled?: boolean,
		min_amount?: number,
		max_amount?: number,
	): Promise<OrchardMintNut05Update> {
		try {
			await this.cashuMintRpcService.updateNut05({unit, method, disabled, min_amount, max_amount});
			return {unit, method, disabled, min_amount, max_amount};
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.MintRpcActionError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	async updateMintNut05Quote(tag: string, quote_id: string, state: string): Promise<OrchardMintNut05QuoteUpdate> {
		try {
			await this.cashuMintRpcService.updateNut05Quote({quote_id, state});
			return {quote_id, state};
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.MintRpcActionError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}
}
