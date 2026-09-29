/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query, Mutation, Args, Context} from '@nestjs/graphql';
/* Vendor Dependencies */
import {Throttle, seconds} from '@nestjs/throttler';
/* Application Dependencies */
import {Roles} from '#server/modules/auth/decorators/auth.decorator';
import {UserRole} from '#server/modules/user/user.enums';
/* Local Dependencies */
import {EcashSeedService} from './ecashseed.service.js';
import {OrchardEcashSeed} from './ecashseed.model.js';

@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.READER)
@Resolver()
export class EcashSeedResolver {
	private readonly logger = new Logger(EcashSeedResolver.name);

	constructor(private ecashSeedService: EcashSeedService) {}

	@Query(() => OrchardEcashSeed, {nullable: true, description: "Get the backup status of the current user's ecash wallet seed"})
	async ecash_seed(@Context() context: any): Promise<OrchardEcashSeed | null> {
		const tag = 'GET { ecash_seed }';
		this.logger.debug(tag);
		return await this.ecashSeedService.getEcashSeed(tag, context.req.user.id);
	}

	@Throttle({default: {limit: 4, ttl: seconds(10)}})
	@Mutation(() => String, {description: "Reveal the current user's ecash wallet mnemonic"})
	async ecash_seed_reveal(
		@Context() context: any,
		@Args('password', {description: "The current user's password"}) password: string,
	): Promise<string> {
		const tag = 'MUTATION { ecash_seed_reveal }';
		this.logger.debug(tag);
		return await this.ecashSeedService.revealEcashSeed(tag, context.req.user.id, password);
	}

	@Mutation(() => OrchardEcashSeed, {description: 'Confirm the current user has backed up their ecash wallet mnemonic'})
	async ecash_seed_backup(@Context() context: any): Promise<OrchardEcashSeed> {
		const tag = 'MUTATION { ecash_seed_backup }';
		this.logger.debug(tag);
		return await this.ecashSeedService.backupEcashSeed(tag, context.req.user.id);
	}
}
