/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query, Context, Mutation, Args} from '@nestjs/graphql';
import {Throttle, minutes} from '@nestjs/throttler';
/* Application Dependencies */
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
import {UserRole} from '#server/modules/user/user.enums';
import {Roles} from '#server/modules/auth/decorators/auth.decorator';
/* Local Dependencies */
import {CrewInviteService} from './crewinvite.service.js';
import {OrchardCrewInvite} from './crewinvite.model.js';
import {InviteCreateInput, InviteUpdateInput} from './crewinvite.input.js';

@Resolver()
export class CrewInviteResolver {
	private readonly logger = new Logger(CrewInviteResolver.name);

	constructor(private crewInviteService: CrewInviteService) {}

	@Roles(UserRole.ADMIN)
	@Query(() => [OrchardCrewInvite], {description: 'Get all crew invites'})
	async crew_invites(@Context() context: any): Promise<OrchardCrewInvite[]> {
		const tag = 'GET { crew_invites }';
		this.logger.debug(tag);
		const user = context.req.user;
		if (!user) throw new OrchardApiError(OrchardErrorCode.UserError);
		return await this.crewInviteService.getInvites(tag);
	}

	@Roles(UserRole.ADMIN)
	@Throttle({default: {limit: 10, ttl: minutes(1)}})
	@Mutation(() => OrchardCrewInvite, {description: 'Create a new crew invite'})
	async crew_invite_create(
		@Context() context: any,
		@Args('createInvite', {description: 'Invite creation details'}) createInvite: InviteCreateInput,
	): Promise<OrchardCrewInvite> {
		const tag = 'MUTATION { crew_invite_create }';
		this.logger.debug(tag);
		const user = context.req.user;
		if (!user) throw new OrchardApiError(OrchardErrorCode.UserError);
		if (createInvite.role === UserRole.ADMIN) throw new OrchardApiError(OrchardErrorCode.InviteNoAdminError);
		return await this.crewInviteService.createInvite(tag, user.id, createInvite);
	}

	@Roles(UserRole.ADMIN)
	@Mutation(() => OrchardCrewInvite, {description: 'Update an existing crew invite'})
	async crew_invite_update(
		@Args('updateInvite', {description: 'Invite fields to update'}) updateInvite: InviteUpdateInput,
	): Promise<OrchardCrewInvite> {
		const tag = 'MUTATION { crew_invite_update }';
		if (updateInvite.role === UserRole.ADMIN) throw new OrchardApiError(OrchardErrorCode.InviteNoAdminError);
		this.logger.debug(tag);
		return await this.crewInviteService.updateInvite(tag, updateInvite);
	}

	@Roles(UserRole.ADMIN)
	@Mutation(() => Boolean, {description: 'Delete a crew invite'})
	async crew_invite_delete(@Args('id', {description: 'ID of the invite to delete'}) id: string): Promise<boolean> {
		const tag = 'MUTATION { crew_invite_delete }';
		this.logger.debug(tag);
		await this.crewInviteService.deleteInvite(tag, id);
		return true;
	}
}
