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

@Resolver()
export class FederationResolver {
	private readonly logger = new Logger(FederationResolver.name);

	constructor(
		private federationService: FederationService,
		private errorService: ErrorService,
	) {}

	/** Read the mode through the authenticated GraphQL API before loading mint pages. */
	@Query(() => OrchardFederationMode, {description: 'Get the mode of the configured mint daemon'})
	async federation_mode(): Promise<OrchardFederationMode> {
		const tag = 'GET { federation_mode }';
		this.logger.debug(tag);
		try {
			return await this.federationService.getMode();
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.MintRpcActionError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}
}
