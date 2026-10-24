/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Args, Mutation, Query, Resolver} from '@nestjs/graphql';

/* Application Dependencies */
import {FederationSetupService} from '#server/modules/federation/federation-setup.service';
import {Roles} from '#server/modules/auth/decorators/auth.decorator';
import {UserRole} from '#server/modules/user/user.enums';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';

/* Native Dependencies */
import {FederationSetupCreateInput, FederationSetupJoinInput} from './federation-setup.input.js';
import {
	OrchardFederationSetupCreated,
	OrchardFederationSetupJoined,
	OrchardFederationSetupProposalHash,
	OrchardFederationSetupReview,
	OrchardFederationSetupStatus,
	OrchardFederationSetupActivated,
} from './federation-setup.model.js';

@Resolver()
@Roles(UserRole.ADMIN)
export class FederationSetupResolver {
	private readonly logger = new Logger(FederationSetupResolver.name);

	constructor(
		private federationSetupService: FederationSetupService,
		private errorService: ErrorService,
	) {}

	/** Create a local setup; invitation payloads are never sent to event logging. */
	@Mutation(() => OrchardFederationSetupCreated, {name: 'federation_setup_create'})
	public create(@Args('input') input: FederationSetupCreateInput): Promise<OrchardFederationSetupCreated> {
		return this.call(() => this.federationSetupService.create(input));
	}

	/** Enroll this mint with the supplied secret invitation. */
	@Mutation(() => OrchardFederationSetupJoined, {name: 'federation_setup_join'})
	public join(@Args('input') input: FederationSetupJoinInput): Promise<OrchardFederationSetupJoined> {
		return this.call(() => this.federationSetupService.join(input));
	}

	/** Publish the coordinator's proposal. */
	@Mutation(() => OrchardFederationSetupProposalHash, {name: 'federation_setup_propose'})
	public propose(): Promise<OrchardFederationSetupProposalHash> {
		return this.call(() => this.federationSetupService.propose());
	}

	/** Review the proposal and member identities. */
	@Query(() => OrchardFederationSetupReview, {name: 'federation_setup_review'})
	public review(): Promise<OrchardFederationSetupReview> {
		return this.call(() => this.federationSetupService.review());
	}

	/** Approve by hash; fingerprint checking is an operator-side confirmation. */
	@Mutation(() => OrchardFederationSetupProposalHash, {name: 'federation_setup_approve'})
	public approve(@Args('proposal_hash') proposal_hash: string): Promise<OrchardFederationSetupProposalHash> {
		return this.call(() => this.federationSetupService.approve(proposal_hash));
	}

	/** Read local setup progress and any unused invitations in this process. */
	@Query(() => OrchardFederationSetupStatus, {name: 'federation_setup_status'})
	public getStatus(): Promise<OrchardFederationSetupStatus> {
		return this.call(() => this.federationSetupService.getStatus());
	}

	/** Activate the finalized configuration on this mint. */
	@Mutation(() => OrchardFederationSetupActivated, {name: 'federation_setup_activate'})
	public activate(): Promise<OrchardFederationSetupActivated> {
		return this.call(() => this.federationSetupService.activate());
	}

	/** Preserve upstream diagnostics without logging request arguments or response secrets. */
	private async call<T>(action: () => Promise<T>): Promise<T> {
		try {
			return await action();
		} catch (error) {
			throw new OrchardApiError(
				this.errorService.resolveError(this.logger, error, 'Federation setup', {
					errord: OrchardErrorCode.MintRpcActionError,
				}),
			);
		}
	}
}
