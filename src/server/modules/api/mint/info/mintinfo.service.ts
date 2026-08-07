/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {CashuMintApiService} from '@server/modules/cashu/mintapi/cashumintapi.service';
import {CashuMintRpcService} from '@server/modules/cashu/mintrpc/cashumintrpc.service';
import {CashuMintInfo} from '@server/modules/cashu/mintapi/cashumintapi.types';
import {CashuMintInfoRpc} from '@server/modules/cashu/mintrpc/cashumintrpc.types';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
import {ErrorService} from '@server/modules/error/error.service';
/* Local Dependencies */
import {
	OrchardMintInfo,
	OrchardMintInfoRpc,
	OrchardMintNameUpdate,
	OrchardMintIconUpdate,
	OrchardMintDescriptionUpdate,
	OrchardMintMotdUpdate,
	OrchardMintUrlUpdate,
	OrchardMintContactUpdate,
} from './mintinfo.model.js';

@Injectable()
export class MintInfoService {
	private readonly logger = new Logger(MintInfoService.name);

	constructor(
		private cashuMintApiService: CashuMintApiService,
		private cashuMintRpcService: CashuMintRpcService,
		private errorService: ErrorService,
	) {}

	async getMintInfo(tag: string): Promise<OrchardMintInfo> {
		try {
			const cashu_info: CashuMintInfo = await this.cashuMintApiService.getMintInfo();
			return new OrchardMintInfo(cashu_info);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.MintPublicApiError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	async getMintInfoRpc(tag: string): Promise<OrchardMintInfoRpc> {
		try {
			const cashu_info: CashuMintInfoRpc = await this.cashuMintRpcService.getMintInfo();
			return new OrchardMintInfoRpc(cashu_info);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.MintRpcActionError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	async updateMintName(tag: string, name: string): Promise<OrchardMintNameUpdate> {
		try {
			await this.cashuMintRpcService.updateName({name});
			return {name};
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.MintRpcActionError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	async updateMintIcon(tag: string, icon_url: string): Promise<OrchardMintIconUpdate> {
		try {
			await this.cashuMintRpcService.updateIconUrl({icon_url});
			return {icon_url};
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.MintRpcActionError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	async updateMintShortDescription(tag: string, description: string): Promise<OrchardMintDescriptionUpdate> {
		try {
			await this.cashuMintRpcService.updateShortDescription({description});
			return {description};
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.MintRpcActionError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	async updateMintLongDescription(tag: string, description: string): Promise<OrchardMintDescriptionUpdate> {
		try {
			await this.cashuMintRpcService.updateLongDescription({description});
			return {description};
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.MintRpcActionError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	async updateMintMotd(tag: string, motd: string): Promise<OrchardMintMotdUpdate> {
		try {
			await this.cashuMintRpcService.updateMotd({motd});
			return {motd};
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.MintRpcActionError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	async addMintUrl(tag: string, url: string): Promise<OrchardMintUrlUpdate> {
		try {
			await this.cashuMintRpcService.addUrl({url});
			return {url};
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.MintRpcActionError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	async removeMintUrl(tag: string, url: string): Promise<OrchardMintUrlUpdate> {
		try {
			await this.cashuMintRpcService.removeUrl({url});
			return {url};
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.MintRpcActionError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	async addMintContact(tag: string, method: string, info: string): Promise<OrchardMintContactUpdate> {
		try {
			await this.cashuMintRpcService.addContact({method, info});
			return {method, info};
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.MintRpcActionError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	async removeMintContact(tag: string, method: string, info: string): Promise<OrchardMintContactUpdate> {
		try {
			await this.cashuMintRpcService.removeContact({method, info});
			return {method, info};
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.MintRpcActionError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}
}
