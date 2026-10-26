/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Args, Query, Resolver} from '@nestjs/graphql';

/* Application Dependencies */
import {FederationSettingsService} from '#server/modules/federation/federation-settings.service';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';

/* Local Dependencies */
import {OrchardFederationSettingsComparison} from './federation-settings.model.js';

@Resolver()
export class FederationSettingsResolver {
	private readonly logger = new Logger(FederationSettingsResolver.name);

	constructor(
		private readonly federationSettingsService: FederationSettingsService,
		private readonly errorService: ErrorService,
	) {}

	/** Compare public member settings through the authenticated read API. */
	@Query(() => OrchardFederationSettingsComparison, {
		description: 'Compare federation members public metadata and payment settings with this member',
	})
	public async federation_settings_comparison(
		@Args('refresh', {
			type: () => Boolean,
			defaultValue: false,
			description: 'Fetch current public settings instead of using the sixty-second cache',
		})
		refresh: boolean = false,
	): Promise<OrchardFederationSettingsComparison> {
		try {
			return await this.federationSettingsService.getComparison(refresh);
		} catch (error) {
			throw new OrchardApiError(
				this.errorService.resolveError(this.logger, error, 'GET { federation_settings_comparison }', {
					errord: OrchardErrorCode.MintRpcActionError,
				}),
			);
		}
	}
}
