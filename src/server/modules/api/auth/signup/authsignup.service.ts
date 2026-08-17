/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {AuthService} from '#server/modules/auth/auth.service';
import {ErrorService} from '#server/modules/error/error.service';
import {UserService} from '#server/modules/user/user.service';
import {InviteService} from '#server/modules/invite/invite.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
/* Native Dependencies */
import {OrchardAuthentication} from '#server/modules/api/auth/authentication/authentication.model';
/* Local Dependencies */
import {AuthSignupInput} from './authsignup.input.js';

@Injectable()
export class AuthSignupService {
	private readonly logger = new Logger(AuthSignupService.name);

	constructor(
		private authService: AuthService,
		private errorService: ErrorService,
		private userService: UserService,
		private inviteService: InviteService,
	) {}

	async signup(tag: string, signup: AuthSignupInput): Promise<OrchardAuthentication> {
		try {
			const invite = await this.inviteService.getValidInvite(signup.key);
			if (!invite) throw OrchardErrorCode.InviteInvalidError;
			const user = await this.userService.getUserByName(signup.name);
			if (user) throw OrchardErrorCode.UniqueUsernameError;
			const new_user = await this.userService.createUser(signup.name, signup.password, invite.role, invite.label);
			await this.inviteService.claimInvite(invite.id, new_user.id);
			const token = await this.authService.getToken(new_user.id, signup.password);
			if (!token) throw OrchardErrorCode.AuthenticationError;
			return new OrchardAuthentication(token);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.SignupError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}
}
