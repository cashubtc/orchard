/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {CashuMintDatabaseService} from '@server/modules/cashu/mintdb/cashumintdb.service';
import {CashuMintSwap} from '@server/modules/cashu/mintdb/cashumintdb.types';
import {CashuMintSwapsArgs} from '@server/modules/cashu/mintdb/cashumintdb.interfaces';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
import {MintService} from '@server/modules/api/mint/mint.service';
import {ErrorService} from '@server/modules/error/error.service';
/* Local Dependencies */
import {OrchardMintSwap} from './mintswap.model.js';

@Injectable()
export class MintSwapService {
	private readonly logger = new Logger(MintSwapService.name);

	constructor(
		private cashuMintDatabaseService: CashuMintDatabaseService,
		private mintService: MintService,
		private errorService: ErrorService,
	) {}

	async getMintSwaps(tag: string, args?: CashuMintSwapsArgs): Promise<OrchardMintSwap[]> {
		return this.mintService.withDbClient(async (client) => {
			try {
				const cashu_mint_swaps: CashuMintSwap[] = await this.cashuMintDatabaseService.listSwaps(client, args);
				return cashu_mint_swaps.map((cmp) => new OrchardMintSwap(cmp));
			} catch (error) {
				const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
					errord: OrchardErrorCode.MintDatabaseSelectError,
				});
				throw new OrchardApiError(orchard_error);
			}
		});
	}
}
