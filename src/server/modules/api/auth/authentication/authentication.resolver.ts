/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Args, Mutation, Context} from '@nestjs/graphql';
import {UseGuards} from '@nestjs/common';
import {Throttle, seconds} from '@nestjs/throttler';
/* Application Dependencies */
import {GqlRefreshGuard} from '@server/modules/security/guards/refresh.guard';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
import {Public} from '@server/modules/auth/decorators/auth.decorator';
/* Local Dependencies */
import {AuthAuthenticationService} from './authentication.service.js';
import {OrchardAuthentication} from './authentication.model.js';
import {AuthenticationInput} from './authentication.input.js';

@Resolver(() => [OrchardAuthentication])
export class AuthAuthenticationResolver {
	private readonly logger = new Logger(AuthAuthenticationResolver.name);

	constructor(private authenticationService: AuthAuthenticationService) {}

	@Public()
	@Throttle({default: {limit: 4, ttl: seconds(10)}})
	@Mutation(() => OrchardAuthentication, {description: 'Authenticate a user with credentials'})
	async auth_authentication(@Args('authentication', {description: 'User login credentials'}) authentication: AuthenticationInput) {
		const tag = 'MUTATION { authentication }';
		this.logger.debug(tag);
		return await this.authenticationService.authenticate(tag, authentication);
	}

	/* @Public skips the global access-token guard; GqlRefreshGuard provides the actual authentication
	   for these endpoints, requiring a valid signed refresh token as the Bearer credential */
	@Public()
	@Mutation(() => OrchardAuthentication, {description: 'Refresh an expired access token using a refresh token'})
	@UseGuards(GqlRefreshGuard)
	async auth_authentication_refresh(@Context() context: any) {
		const tag = 'MUTATION { refresh_authentication }';
		this.logger.debug(tag);
		const req = context.req;
		const user = req?.user;
		if (!user) throw new OrchardApiError(OrchardErrorCode.AuthenticationExpiredError);
		if (!user.refresh_token) throw new OrchardApiError(OrchardErrorCode.AuthenticationExpiredError);
		return await this.authenticationService.refreshAuthentication(tag, user.refresh_token);
	}

	@Public()
	@Mutation(() => Boolean, {description: 'Revoke a refresh token to log out'})
	@UseGuards(GqlRefreshGuard)
	async auth_authentication_revoke(@Context() context: any) {
		const tag = 'MUTATION { revoke_authentication }';
		this.logger.debug(tag);
		const req = context.req;
		const user = req?.user;
		if (!user) throw new OrchardApiError(OrchardErrorCode.AuthenticationExpiredError);
		if (!user.refresh_token) throw new OrchardApiError(OrchardErrorCode.AuthenticationExpiredError);
		return await this.authenticationService.revokeAuthentication(tag, user.refresh_token);
	}
}
