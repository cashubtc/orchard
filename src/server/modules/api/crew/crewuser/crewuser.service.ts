/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {ErrorService} from '#server/modules/error/error.service';
import {UserService} from '#server/modules/user/user.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {OrchardCrewUser} from './crewuser.model.js';
import {UserNameUpdateInput, UserPasswordUpdateInput, UserUpdateInput} from './crewuser.input.js';

@Injectable()
export class CrewUserService {
	private readonly logger = new Logger(CrewUserService.name);

	constructor(
		private errorService: ErrorService,
		private userService: UserService,
	) {}

	async getUser(tag: string, id: string): Promise<OrchardCrewUser> {
		try {
			const user = await this.userService.getUserById(id);
			return new OrchardCrewUser(user);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.UserError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	async getUsers(tag: string): Promise<OrchardCrewUser[]> {
		try {
			const users = await this.userService.getUsers();
			return users.map((user) => new OrchardCrewUser(user));
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.UserError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	async updateUserName(tag: string, id: string, args: UserNameUpdateInput): Promise<OrchardCrewUser> {
		try {
			const user = await this.userService.updateUser(id, {name: args.name});
			return new OrchardCrewUser(user);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.UserError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	async updateUserPassword(tag: string, id: string, args: UserPasswordUpdateInput): Promise<OrchardCrewUser> {
		try {
			const user = await this.userService.getUserById(id);
			if (!user) throw OrchardErrorCode.UserError;
			const valid = await this.userService.validatePassword(user, args.password_old);
			if (!valid) throw OrchardErrorCode.InvalidPasswordError;
			const user_updated = await this.userService.updateUser(id, {}, args.password_new);
			return new OrchardCrewUser(user_updated);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.UserError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	async updateUserTelegram(tag: string, id: string, telegram_chat_id: string | null): Promise<OrchardCrewUser> {
		try {
			const user = await this.userService.updateUser(id, {telegram_chat_id});
			return new OrchardCrewUser(user);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.UserError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	async updateUser(tag: string, args: UserUpdateInput): Promise<OrchardCrewUser> {
		try {
			const user = await this.userService.updateUser(args.id, args);
			return new OrchardCrewUser(user);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.UserError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	async deleteUser(tag: string, id: string): Promise<void> {
		try {
			await this.userService.deleteUser(id);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.UserError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}
}
