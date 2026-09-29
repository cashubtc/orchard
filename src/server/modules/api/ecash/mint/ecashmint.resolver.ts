/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query, Mutation, Args, Context, ID} from '@nestjs/graphql';
/* Application Dependencies */
import {Roles} from '#server/modules/auth/decorators/auth.decorator';
import {UserRole} from '#server/modules/user/user.enums';
/* Local Dependencies */
import {EcashMintService} from './ecashmint.service.js';
import {OrchardEcashMint} from './ecashmint.model.js';

@Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.READER)
@Resolver()
export class EcashMintResolver {
	private readonly logger = new Logger(EcashMintResolver.name);

	constructor(private ecashMintService: EcashMintService) {}

	@Query(() => [OrchardEcashMint], {description: "Get the mints in the current user's ecash wallet"})
	async ecash_mints(@Context() context: any): Promise<OrchardEcashMint[]> {
		const tag = 'GET { ecash_mints }';
		this.logger.debug(tag);
		return await this.ecashMintService.getEcashMints(tag, context.req.user.id);
	}

	@Mutation(() => OrchardEcashMint, {description: "Add a mint to the current user's ecash wallet"})
	async ecash_mint_add(
		@Context() context: any,
		@Args('mint_url', {description: 'URL of the mint to add'}) mint_url: string,
	): Promise<OrchardEcashMint> {
		const tag = 'MUTATION { ecash_mint_add }';
		this.logger.debug(tag);
		return await this.ecashMintService.addEcashMint(tag, context.req.user.id, mint_url);
	}

	@Mutation(() => Boolean, {description: "Remove a mint from the current user's ecash wallet"})
	async ecash_mint_remove(
		@Context() context: any,
		@Args('mint_id', {type: () => ID, description: 'Wallet mint identifier'}) mint_id: string,
	): Promise<boolean> {
		const tag = 'MUTATION { ecash_mint_remove }';
		this.logger.debug(tag);
		return await this.ecashMintService.removeEcashMint(tag, context.req.user.id, mint_id);
	}
}
