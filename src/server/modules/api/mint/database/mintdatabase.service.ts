/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {CashuMintDatabaseService} from '#server/modules/cashu/mintdb/cashumintdb.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {MintService} from '#server/modules/api/mint/mint.service';
import {ErrorService} from '#server/modules/error/error.service';
/* Local Dependencies */
import {OrchardMintDatabaseBackup, OrchardMintDatabaseInfo, OrchardMintDatabaseRestore} from './mintdatabase.model.js';

@Injectable()
export class MintDatabaseService {
	private readonly logger = new Logger(MintDatabaseService.name);

	constructor(
		private cashuMintDatabaseService: CashuMintDatabaseService,
		private mintService: MintService,
		private errorService: ErrorService,
	) {}

	async getMintDatabaseInfo(tag: string): Promise<OrchardMintDatabaseInfo> {
		return this.mintService.withDbClient(async (client) => {
			try {
				const info = await this.cashuMintDatabaseService.getDatabaseInfo(client);
				return new OrchardMintDatabaseInfo(info);
			} catch (error) {
				const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
					errord: OrchardErrorCode.MintDatabaseSelectError,
				});
				throw new OrchardApiError(orchard_error);
			}
		});
	}

	async createMintDatabaseBackup(tag: string): Promise<OrchardMintDatabaseBackup> {
		return this.mintService.withDbClient(async (client) => {
			try {
				const database_buffer: Buffer = await this.cashuMintDatabaseService.createBackup(client);
				const filebase64 = database_buffer.toString('base64');
				return new OrchardMintDatabaseBackup(filebase64);
			} catch (error) {
				const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
					errord: OrchardErrorCode.MintDatabaseBackupError,
				});
				throw new OrchardApiError(orchard_error);
			}
		});
	}

	async restoreMintDatabaseBackup(tag: string, filebase64: string): Promise<OrchardMintDatabaseRestore> {
		try {
			await this.cashuMintDatabaseService.restoreBackup(filebase64);
			return new OrchardMintDatabaseRestore(true);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.MintDatabaseRestoreError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}
}
