/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Query, Resolver} from '@nestjs/graphql';

/* Application Dependencies */
import {FederationService} from '#server/modules/federation/federation.service';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';

/* Local Dependencies */
import {OrchardFederationMode} from './federation.model.js';
import {
	OrchardFederationInfo,
	OrchardFederationLocalStatus,
	OrchardFederationMemberStatuses,
	OrchardFederationCustodyStatus,
} from './federation-status.model.js';

@Resolver()
export class FederationResolver {
	private readonly logger = new Logger(FederationResolver.name);

	constructor(
		private federationService: FederationService,
		private errorService: ErrorService,
	) {}

	/** Read the mode through the authenticated GraphQL API before loading mint pages. */
	@Query(() => OrchardFederationMode, {description: 'Get the mode of the configured mint daemon'})
	federation_mode(): Promise<OrchardFederationMode> {
		return this.read('federation_mode', () => this.federationService.getMode());
	}

	/** Read the federation config this member runs. */
	@Query(() => OrchardFederationInfo, {description: 'Get the federation config of a member mint'})
	federation_info(): Promise<OrchardFederationInfo> {
		return this.read('federation_info', () => this.federationService.getInfo());
	}

	/** Read this member's own consensus, checkpoint and queue state. */
	@Query(() => OrchardFederationLocalStatus, {description: 'Get the local status of a member mint'})
	federation_local_status(): Promise<OrchardFederationLocalStatus> {
		return this.read('federation_local_status', () => this.federationService.getLocalStatus());
	}

	/** Read peer statuses and digest agreement. */
	@Query(() => OrchardFederationMemberStatuses, {description: 'Get the status of every federation member'})
	federation_member_statuses(): Promise<OrchardFederationMemberStatuses> {
		return this.read('federation_member_statuses', () => this.federationService.getMemberStatuses());
	}

	/** Read the custody backends this member reports. */
	@Query(() => OrchardFederationCustodyStatus, {description: 'Get the custody status of a member mint'})
	federation_custody_status(): Promise<OrchardFederationCustodyStatus> {
		return this.read('federation_custody_status', () => this.federationService.getCustodyStatus());
	}

	/** Map RPC failures to an Orchard error without losing the upstream diagnostic. */
	private async read<T>(field: string, request: () => Promise<T>): Promise<T> {
		const tag = `GET { ${field} }`;
		this.logger.debug(tag);
		try {
			return await request();
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.MintRpcActionError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}
}
