/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {AuthService} from '#server/modules/auth/auth.service';
import {ErrorService} from '#server/modules/error/error.service';
import {UserService} from '#server/modules/user/user.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
/* Local Dependencies */
import {OrchardAuthentication} from './authentication.model.js';
import {AuthenticationInput} from './authentication.input.js';

@Injectable()
export class AuthAuthenticationService {
	private readonly logger = new Logger(AuthAuthenticationService.name);

	constructor(
		private authService: AuthService,
		private errorService: ErrorService,
		private userService: UserService,
	) {}

	async authenticate(tag: string, authentication: AuthenticationInput): Promise<OrchardAuthentication> {
		try {
			const user = await this.userService.getUserByName(authentication.name);
			if (!user) throw OrchardErrorCode.AuthenticationError;
			const token = await this.authService.getToken(user.id, authentication.password);
			if (!token) throw OrchardErrorCode.AuthenticationError;
			return new OrchardAuthentication(token);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.AuthenticationError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	async refreshAuthentication(tag: string, refresh_token: string): Promise<OrchardAuthentication> {
		try {
			const token = await this.authService.refreshToken(refresh_token);
			if (!token) throw OrchardErrorCode.AuthenticationExpiredError;
			return new OrchardAuthentication(token);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.AuthenticationExpiredError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	async revokeAuthentication(tag: string, token: string): Promise<boolean> {
		try {
			return this.authService.revokeToken(token);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.AuthenticationExpiredError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}
}
