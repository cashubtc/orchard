/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query, Mutation, Args, Context, ID} from '@nestjs/graphql';
/* Application Dependencies */
import {UserRole} from '#server/modules/user/user.enums';
/* Local Dependencies */
import {EcashMintService} from './ecashmint.service.js';
import {OrchardEcashMint, OrchardEcashMintLookup, OrchardEcashMintStatus} from './ecashmint.model.js';

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

	@Query(() => [OrchardEcashMintStatus], {
		description: "Check whether mints in the current user's ecash wallet are reachable: one when given, else all",
	})
	async ecash_mint_status(
		@Context() context: any,
		@Args('mint_id', {type: () => ID, nullable: true, description: 'Wallet mint to check; every mint when left out'}) mint_id?: string,
	): Promise<OrchardEcashMintStatus[]> {
		const tag = 'GET { ecash_mint_status }';
		this.logger.debug(tag);
		return await this.ecashMintService.getEcashMintStatus(tag, context.req.user.id, mint_id ?? null);
	}

	@Query(() => OrchardEcashMintLookup, {description: "Look a mint up before adding it to the current user's ecash wallet"})
	async ecash_mint_lookup(
		@Context() context: any,
		@Args('mint_url', {description: 'URL of the mint to look up'}) mint_url: string,
	): Promise<OrchardEcashMintLookup> {
		const tag = 'GET { ecash_mint_lookup }';
		this.logger.debug(tag);
		const allow_local = context.req.user.role === UserRole.ADMIN;
		return await this.ecashMintService.lookupEcashMint(tag, context.req.user.id, mint_url, allow_local);
	}

	@Mutation(() => OrchardEcashMint, {description: "Add a mint to the current user's ecash wallet"})
	async ecash_mint_add(
		@Context() context: any,
		@Args('mint_url', {description: 'URL of the mint to add'}) mint_url: string,
	): Promise<OrchardEcashMint> {
		const tag = 'MUTATION { ecash_mint_add }';
		this.logger.debug(tag);
		const allow_local = context.req.user.role === UserRole.ADMIN;
		return await this.ecashMintService.addEcashMint(tag, context.req.user.id, mint_url, allow_local);
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
