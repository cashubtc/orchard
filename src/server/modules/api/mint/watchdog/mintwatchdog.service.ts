/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Vendor Dependencies */
import {DateTime} from 'luxon';
/* Application Dependencies */
import {CashuMintDatabaseService} from '@server/modules/cashu/mintdb/cashumintdb.service';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
import {MintService} from '@server/modules/api/mint/mint.service';
import {ErrorService} from '@server/modules/error/error.service';
/* Local Dependencies */
import {OrchardMintWatchdogStatus} from './mintwatchdog.model.js';

const WATCHDOG_FRESHNESS_SECONDS = 90000; // 25 hours

@Injectable()
export class MintWatchdogService {
	private readonly logger = new Logger(MintWatchdogService.name);

	constructor(
		private cashuMintDatabaseService: CashuMintDatabaseService,
		private mintService: MintService,
		private errorService: ErrorService,
	) {}

	async getWatchdogStatus(tag: string): Promise<OrchardMintWatchdogStatus> {
		return this.mintService.withDbClient(async (client) => {
			try {
				const last_seen = await this.cashuMintDatabaseService.getWatchdogLastSeen(client);
				const now = DateTime.utc().toUnixInteger();
				const is_alive = last_seen !== null && now - last_seen < WATCHDOG_FRESHNESS_SECONDS;
				return new OrchardMintWatchdogStatus(is_alive, last_seen);
			} catch (error) {
				const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
					errord: OrchardErrorCode.MintDatabaseSelectError,
				});
				throw new OrchardApiError(orchard_error);
			}
		});
	}
}
