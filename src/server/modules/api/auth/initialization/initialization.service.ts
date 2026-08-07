/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {AuthService} from '@server/modules/auth/auth.service';
import {ErrorService} from '@server/modules/error/error.service';
import {UserService} from '@server/modules/user/user.service';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
import {UserRole} from '@server/modules/user/user.enums';
/* Native Dependencies */
import {OrchardAuthentication} from '@server/modules/api/auth/authentication/authentication.model';
/* Local Dependencies */
import {OrchardInitialization} from './initialization.model.js';
import {InitializationInput} from './initialization.input.js';

@Injectable()
export class AuthInitializationService {
	private readonly logger = new Logger(AuthInitializationService.name);

	constructor(
		private authService: AuthService,
		private errorService: ErrorService,
		private userService: UserService,
	) {}

	async initialize(tag: string, initialization: InitializationInput): Promise<OrchardAuthentication> {
		try {
			const initialized = await this.authService.getInitialization();
			if (initialized) throw OrchardErrorCode.InitializationError;
			const valid = await this.authService.validateSetupKey(initialization.key);
			if (!valid) throw OrchardErrorCode.InitializationKeyError;
			const user = await this.userService.getUserByName(initialization.name);
			if (user) throw OrchardErrorCode.UniqueUsernameError;
			const admin = await this.userService.createUser(initialization.name, initialization.password, UserRole.ADMIN);
			const token = await this.authService.getToken(admin.id, initialization.password);
			if (!token) throw OrchardErrorCode.AuthenticationError;
			return new OrchardAuthentication(token);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.AuthenticationError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	async getInitialization(tag: string): Promise<OrchardInitialization> {
		try {
			const initialization = await this.authService.getInitialization();
			return new OrchardInitialization(initialization);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.AuthenticationError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}
}
