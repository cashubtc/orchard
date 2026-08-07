/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {CashuMintDatabaseService} from '@server/modules/cashu/mintdb/cashumintdb.service';
import {CashuMintMintQuotesArgs, CashuMintMeltQuotesArgs, CashuMintSwapsArgs} from '@server/modules/cashu/mintdb/cashumintdb.interfaces';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
import {MintService} from '@server/modules/api/mint/mint.service';
import {ErrorService} from '@server/modules/error/error.service';
/* Local Dependencies */
import {OrchardMintCount} from './mintcount.model.js';

@Injectable()
export class MintCountService {
	private readonly logger = new Logger(MintCountService.name);

	constructor(
		private cashuMintDatabaseService: CashuMintDatabaseService,
		private mintService: MintService,
		private errorService: ErrorService,
	) {}

	async getMintCountMintQuotes(tag: string, args?: CashuMintMintQuotesArgs): Promise<OrchardMintCount> {
		return this.mintService.withDbClient(async (client) => {
			try {
				const count: number = await this.cashuMintDatabaseService.countMintQuotes(client, args);
				return new OrchardMintCount(count);
			} catch (error) {
				const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
					errord: OrchardErrorCode.MintDatabaseSelectError,
				});
				throw new OrchardApiError(orchard_error);
			}
		});
	}

	async getMintCountMeltQuotes(tag: string, args?: CashuMintMeltQuotesArgs): Promise<OrchardMintCount> {
		return this.mintService.withDbClient(async (client) => {
			try {
				const count: number = await this.cashuMintDatabaseService.countMeltQuotes(client, args);
				return new OrchardMintCount(count);
			} catch (error) {
				const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
					errord: OrchardErrorCode.MintDatabaseSelectError,
				});
				throw new OrchardApiError(orchard_error);
			}
		});
	}

	async getMintCountSwaps(tag: string, args?: CashuMintSwapsArgs): Promise<OrchardMintCount> {
		return this.mintService.withDbClient(async (client) => {
			try {
				const count: number = await this.cashuMintDatabaseService.countSwaps(client, args);
				return new OrchardMintCount(count);
			} catch (error) {
				const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
					errord: OrchardErrorCode.MintDatabaseSelectError,
				});
				throw new OrchardApiError(orchard_error);
			}
		});
	}
}
