/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {CashuMintDatabaseService} from '@server/modules/cashu/mintdb/cashumintdb.service';
import {CashuMintRpcService} from '@server/modules/cashu/mintrpc/cashumintrpc.service';
import {CashuMintAnalyticsService} from '@server/modules/cashu/mintanalytics/mintanalytics.service';
import {MintAnalyticsMetric} from '@server/modules/cashu/mintanalytics/mintanalytics.enums';
import {CashuMintKeyset} from '@server/modules/cashu/mintdb/cashumintdb.types';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
import {MintService} from '@server/modules/api/mint/mint.service';
import {ErrorService} from '@server/modules/error/error.service';
/* Local Dependencies */
import {OrchardMintKeyset, OrchardMintKeysetRotation, OrchardMintKeysetCount} from './mintkeyset.model';

@Injectable()
export class MintKeysetService {
	private readonly logger = new Logger(MintKeysetService.name);

	constructor(
		private cashuMintDatabaseService: CashuMintDatabaseService,
		private cashuMintAnalyticsService: CashuMintAnalyticsService,
		private cashuMintRpcService: CashuMintRpcService,
		private mintService: MintService,
		private errorService: ErrorService,
	) {}

	async getMintKeysets(tag: string): Promise<OrchardMintKeyset[]> {
		return this.mintService.withDbClient(async (client) => {
			try {
				const cashu_keysets: CashuMintKeyset[] = await this.cashuMintDatabaseService.getKeysets(client);
				return cashu_keysets.map((ck) => new OrchardMintKeyset(ck));
			} catch (error) {
				const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
					errord: OrchardErrorCode.MintDatabaseSelectError,
				});
				throw new OrchardApiError(orchard_error);
			}
		});
	}

	async getMintKeysetCounts(
		tag: string,
		args?: {date_start?: number; date_end?: number; id_keysets?: string[]},
	): Promise<OrchardMintKeysetCount[]> {
		try {
			const cached = await this.cashuMintAnalyticsService.getCachedAnalytics({
				date_start: args?.date_start,
				date_end: args?.date_end,
				metrics: [MintAnalyticsMetric.keyset_issued, MintAnalyticsMetric.keyset_redeemed],
			});

			const keyset_map = new Map<string, {proof_count: number; promise_count: number}>();
			for (const row of cached) {
				if (row.keyset_id === '') continue;
				const entry = keyset_map.get(row.keyset_id) ?? {proof_count: 0, promise_count: 0};
				if (row.metric === MintAnalyticsMetric.keyset_issued) {
					entry.promise_count += row.count;
				} else if (row.metric === MintAnalyticsMetric.keyset_redeemed) {
					entry.proof_count += row.count;
				}
				keyset_map.set(row.keyset_id, entry);
			}

			let results = Array.from(keyset_map.entries()).map(([id, counts]) => new OrchardMintKeysetCount({id, ...counts}));

			if (args?.id_keysets?.length) {
				const id_set = new Set(args.id_keysets);
				results = results.filter((r) => id_set.has(r.id));
			}

			return results;
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.MintDatabaseSelectError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	async mintRotateKeyset(
		tag: string,
		mint_rotate_keyset: {unit: string; amounts?: number[]; input_fee_ppk?: number; keyset_v2?: boolean; final_expiry?: number},
	): Promise<OrchardMintKeysetRotation> {
		try {
			return await this.cashuMintRpcService.rotateNextKeyset(mint_rotate_keyset);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.MintRpcActionError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}
}
