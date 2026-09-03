/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query, Args} from '@nestjs/graphql';
/* Application Dependencies */
import {normalizeMintUnit} from '#server/modules/cashu/cashu.helpers';
/* Local Dependencies */
import {MintProofService} from './mintproof.service.js';
import {OrchardMintProofGroupStats} from './mintproof.model.js';

@Resolver()
export class MintProofResolver {
	private readonly logger = new Logger(MintProofResolver.name);

	constructor(private mintProofService: MintProofService) {}

	@Query(() => OrchardMintProofGroupStats, {description: 'Get grouped statistics for mint proofs'})
	async mint_proof_group_stats(
		@Args('unit', {type: () => String, description: 'Unit to filter proof statistics by'}) unit: string,
	): Promise<OrchardMintProofGroupStats> {
		const tag = 'GET { mint_proof_group_stats }';
		this.logger.debug(tag);
		return await this.mintProofService.getMintProofGroupStats(tag, normalizeMintUnit(unit));
	}
}
