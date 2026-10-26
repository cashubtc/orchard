/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Args, Int, Mutation, Query, Resolver} from '@nestjs/graphql';

/* Application Dependencies */
import {FederationSetupService} from '#server/modules/federation/federation-setup.service';
import {Roles} from '#server/modules/auth/decorators/auth.decorator';
import {UserRole} from '#server/modules/user/user.enums';
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';

/* Local Dependencies */
import {FederationSetupCreateInput, FederationSetupJoinInput} from './federation-setup.input.js';
import {
	OrchardFederationSetupCreated,
	OrchardFederationSetupInvitationReplaced,
	OrchardFederationSetupAborted,
	OrchardFederationSetupJoined,
	OrchardFederationSetupProposalHash,
	OrchardFederationSetupReview,
	OrchardFederationSetupStatus,
	OrchardFederationSetupActivated,
} from './federation-setup.model.js';

@Resolver()
export class FederationSetupResolver {
	private readonly logger = new Logger(FederationSetupResolver.name);

	constructor(
		private federationSetupService: FederationSetupService,
		private errorService: ErrorService,
	) {}

	/** Create a local setup; invitation payloads are never sent to event logging. */
	@Roles(UserRole.ADMIN)
	@Mutation(() => OrchardFederationSetupCreated, {
		name: 'federation_setup_create',
		description: 'Create a setup on this mint and return secret invitations for the other members',
	})
	public create(
		@Args('input', {description: 'Federation parameters and local coordinator endpoints'}) input: FederationSetupCreateInput,
	): Promise<OrchardFederationSetupCreated> {
		return this.call(() => this.federationSetupService.create(input));
	}

	/** Enroll this mint with the supplied secret invitation. */
	@Roles(UserRole.ADMIN)
	@Mutation(() => OrchardFederationSetupJoined, {
		name: 'federation_setup_join',
		description: 'Join a setup using the invitation issued by its coordinator',
	})
	public join(
		@Args('input', {description: 'Secret invitation and local member endpoints'}) input: FederationSetupJoinInput,
	): Promise<OrchardFederationSetupJoined> {
		return this.call(() => this.federationSetupService.join(input));
	}

	/** Publish the coordinator's proposal. */
	@Roles(UserRole.ADMIN)
	@Mutation(() => OrchardFederationSetupProposalHash, {
		name: 'federation_setup_propose',
		description: 'Publish the proposal after every member has enrolled; coordinator only',
	})
	public propose(): Promise<OrchardFederationSetupProposalHash> {
		return this.call(() => this.federationSetupService.propose());
	}

	/** Review the proposal and member identities. */
	@Query(() => OrchardFederationSetupReview, {
		name: 'federation_setup_review',
		description: 'Read the proposal and public member fingerprints for operator review',
	})
	public review(): Promise<OrchardFederationSetupReview> {
		return this.call(() => this.federationSetupService.review());
	}

	/** Approve by hash; fingerprint checking is an operator-side confirmation. */
	@Roles(UserRole.ADMIN)
	@Mutation(() => OrchardFederationSetupProposalHash, {
		name: 'federation_setup_approve',
		description: 'Approve the exact proposal identified by its hash',
	})
	public approve(
		@Args('proposal_hash', {description: 'Hash returned by the proposal review'}) proposal_hash: string,
	): Promise<OrchardFederationSetupProposalHash> {
		return this.call(() => this.federationSetupService.approve(proposal_hash));
	}

	/** Read local setup progress. */
	@Query(() => OrchardFederationSetupStatus, {
		name: 'federation_setup_status',
		description: 'Read local setup progress without invitation secrets',
	})
	public getStatus(): Promise<OrchardFederationSetupStatus> {
		return this.call(() => this.federationSetupService.getStatus());
	}

	/** Replace an unused invitation without retaining its secret. */
	@Roles(UserRole.ADMIN)
	@Mutation(() => OrchardFederationSetupInvitationReplaced, {
		name: 'federation_setup_replace_invitation',
		description: 'Replace the secret invitation for a member that has not joined; coordinator only',
	})
	public replaceInvitation(
		@Args('member_id', {type: () => Int, description: 'Unenrolled member slot whose invitation is replaced'}) member_id: number,
	): Promise<OrchardFederationSetupInvitationReplaced> {
		return this.call(() => this.federationSetupService.replaceInvitation(member_id));
	}

	/** Abandon this daemon's setup before certification. */
	@Roles(UserRole.ADMIN)
	@Mutation(() => OrchardFederationSetupAborted, {
		name: 'federation_setup_abort',
		description: 'Abort this local setup before certification; other operators must abort separately',
	})
	public abort(
		@Args('setup_id', {description: 'Identifier of the local setup to abort'}) setup_id: string,
	): Promise<OrchardFederationSetupAborted> {
		return this.call(() => this.federationSetupService.abort(setup_id));
	}

	/** Activate the finalized configuration on this mint. */
	@Roles(UserRole.ADMIN)
	@Mutation(() => OrchardFederationSetupActivated, {
		name: 'federation_setup_activate',
		description: 'Activate the finished configuration and restart this mint as a federation member',
	})
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
