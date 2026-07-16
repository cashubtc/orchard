/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
import {ErrorService} from '@server/modules/error/error.service';
/* Native Dependencies */
import {SystemInfoService} from '@server/modules/system/info/sysinfo.service';
/* Local Dependencies */
import {OrchardSystemInfo} from './sysinfo.model';

@Injectable()
export class ApiSystemInfoService {
	private readonly logger = new Logger(ApiSystemInfoService.name);

	constructor(
		private systemInfoService: SystemInfoService,
		private errorService: ErrorService,
	) {}

	/**
	 * Gets live host system information
	 */
	async getSystemInfo(tag: string): Promise<OrchardSystemInfo> {
		try {
			const info = await this.systemInfoService.getSystemInfo();
			return new OrchardSystemInfo(info);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.SystemInfoError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}
}
