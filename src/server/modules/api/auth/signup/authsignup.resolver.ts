/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Args, Mutation} from '@nestjs/graphql';
import {Throttle, seconds} from '@nestjs/throttler';
/* Application Dependencies */
import {Public} from '#server/modules/auth/decorators/auth.decorator';
/* Native Dependencies */
import {OrchardAuthentication} from '#server/modules/api/auth/authentication/authentication.model';
/* Local Dependencies */
import {AuthSignupService} from './authsignup.service.js';
import {AuthSignupInput} from './authsignup.input.js';

@Resolver(() => [OrchardAuthentication])
export class AuthSignupResolver {
	private readonly logger = new Logger(AuthSignupResolver.name);

	constructor(private signupService: AuthSignupService) {}

	@Public()
	@Throttle({default: {limit: 4, ttl: seconds(10)}})
	@Mutation(() => OrchardAuthentication, {description: 'Register a new user account'})
	async auth_signup(@Args('signup', {description: 'New user registration details'}) signup: AuthSignupInput) {
		const tag = 'MUTATION { signup }';
		this.logger.debug(tag);
		return await this.signupService.signup(tag, signup);
	}
}
