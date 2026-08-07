/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Args, Mutation, Query} from '@nestjs/graphql';
import {Throttle, seconds} from '@nestjs/throttler';
/* Application Dependencies */
import {Public} from '@server/modules/auth/decorators/auth.decorator';
/* Native Dependencies */
import {OrchardAuthentication} from '@server/modules/api/auth/authentication/authentication.model';
/* Local Dependencies */
import {AuthInitializationService} from './initialization.service.js';
import {OrchardInitialization} from './initialization.model.js';
import {InitializationInput} from './initialization.input.js';

@Resolver(() => [OrchardAuthentication])
export class AuthInitializationResolver {
	private readonly logger = new Logger(AuthInitializationResolver.name);

	constructor(private initializationService: AuthInitializationService) {}

	@Public()
	@Query(() => OrchardInitialization, {description: 'Check whether the application has been initialized'})
	async auth_initialization() {
		const tag = 'GET { initialization }';
		this.logger.debug(tag);
		return await this.initializationService.getInitialization(tag);
	}

	@Public()
	@Throttle({default: {limit: 4, ttl: seconds(10)}})
	@Mutation(() => OrchardAuthentication, {description: 'Initialize the application with a first admin user'})
	async auth_initialize(@Args('initialize', {description: 'Initial admin user credentials'}) initialize: InitializationInput) {
		const tag = 'MUTATION { initialize }';
		this.logger.debug(tag);
		return await this.initializationService.initialize(tag, initialize);
	}
}
