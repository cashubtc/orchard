/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query, Mutation, Args, Context} from '@nestjs/graphql';
/* Application Dependencies */
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
import {UserRole} from '@server/modules/user/user.enums';
import {Roles} from '@server/modules/auth/decorators/auth.decorator';
/* Local Dependencies */
import {CrewUserService} from './crewuser.service';
import {OrchardCrewUser} from './crewuser.model';
import {UserNameUpdateInput, UserPasswordUpdateInput, UserUpdateInput} from './crewuser.input';

@Resolver()
export class CrewUserResolver {
	private readonly logger = new Logger(CrewUserResolver.name);

	constructor(private crewUserService: CrewUserService) {}

	@Query(() => OrchardCrewUser, {description: 'Get the current authenticated user'})
	async crew_user(@Context() context: any): Promise<OrchardCrewUser> {
		const tag = 'GET { crew_user }';
		this.logger.debug(tag);
		const user = context.req.user;
		if (!user) throw new OrchardApiError(OrchardErrorCode.UserError);
		return await this.crewUserService.getUser(tag, user.id);
	}

	@Query(() => [OrchardCrewUser], {description: 'Get all crew users'})
	async crew_users(): Promise<OrchardCrewUser[]> {
		const tag = 'GET { crew_users }';
		this.logger.debug(tag);
		return await this.crewUserService.getUsers(tag);
	}

	@Mutation(() => OrchardCrewUser, {description: "Update the current user's name"})
	async crew_user_update_name(
		@Context() context: any,
		@Args('updateUserName', {description: 'New name for the user'}) updateUserName: UserNameUpdateInput,
	): Promise<OrchardCrewUser> {
		const tag = 'MUTATION { crew_user_update_name }';
		this.logger.debug(tag);
		const user = context.req.user;
		if (!user) throw new OrchardApiError(OrchardErrorCode.UserError);
		return await this.crewUserService.updateUserName(tag, user.id, updateUserName);
	}

	@Mutation(() => OrchardCrewUser, {description: "Update the current user's password"})
	async crew_user_update_password(
		@Context() context: any,
		@Args('updateUserPassword', {description: 'Old and new password'}) updateUserPassword: UserPasswordUpdateInput,
	): Promise<OrchardCrewUser> {
		const tag = 'MUTATION { crew_user_update_password }';
		this.logger.debug(tag);
		const user = context.req.user;
		if (!user) throw new OrchardApiError(OrchardErrorCode.UserError);
		return await this.crewUserService.updateUserPassword(tag, user.id, updateUserPassword);
	}

	@Mutation(() => OrchardCrewUser, {description: "Update the current user's Telegram chat ID"})
	async crew_user_update_telegram(
		@Context() context: any,
		@Args('telegram_chat_id', {type: () => String, nullable: true, description: 'Telegram chat ID for notifications'})
		telegram_chat_id: string | null,
	): Promise<OrchardCrewUser> {
		const tag = 'MUTATION { crew_user_update_telegram }';
		this.logger.debug(tag);
		const user = context.req.user;
		if (!user) throw new OrchardApiError(OrchardErrorCode.UserError);
		return await this.crewUserService.updateUserTelegram(tag, user.id, telegram_chat_id);
	}

	@Roles(UserRole.ADMIN)
	@Mutation(() => OrchardCrewUser, {description: 'Update a crew user as admin'})
	async crew_user_update(
		@Context() context: any,
		@Args('updateUser', {description: 'User fields to update'}) updateUser: UserUpdateInput,
	): Promise<OrchardCrewUser> {
		const tag = 'MUTATION { crew_user_update }';
		const user = context.req.user;
		if (user.id === updateUser.id) throw new OrchardApiError(OrchardErrorCode.UserInvalidOperationError);
		if (updateUser.role === UserRole.ADMIN) throw new OrchardApiError(OrchardErrorCode.UserInvalidOperationError);
		this.logger.debug(tag);
		return await this.crewUserService.updateUser(tag, updateUser);
	}

	@Roles(UserRole.ADMIN)
	@Mutation(() => Boolean, {description: 'Delete a crew user as admin'})
	async crew_user_delete(@Context() context: any, @Args('id', {description: 'ID of the user to delete'}) id: string): Promise<boolean> {
		const tag = 'MUTATION { crew_user_delete }';
		const user = context.req.user;
		if (user.id === id) throw new OrchardApiError(OrchardErrorCode.UserInvalidOperationError);
		this.logger.debug(tag);
		await this.crewUserService.deleteUser(tag, id);
		return true;
	}
}
