/* Core Dependencies */
import {Logger, UseInterceptors} from '@nestjs/common';
import {Resolver, Query, Mutation, Args, Int, Float} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';
import {Roles} from '#server/modules/auth/decorators/auth.decorator';
import {UserRole} from '#server/modules/user/user.enums';
import {LogEvent} from '#server/modules/event/event.decorator';
import {EventLogType} from '#server/modules/event/event.enums';
/* Local Dependencies */
import {MintKeysetService} from './mintkeyset.service.js';
import {OrchardMintKeyset, OrchardMintKeysetCount, OrchardMintKeysetRotation} from './mintkeyset.model.js';
import {MintKeysetInterceptor} from './mintkeyset.interceptor.js';

@Resolver()
export class MintKeysetResolver {
	private readonly logger = new Logger(MintKeysetResolver.name);

	constructor(private mintKeysetService: MintKeysetService) {}

	@Query(() => [OrchardMintKeyset], {description: 'Get all mint keysets'})
	async mint_keysets(): Promise<OrchardMintKeyset[]> {
		const tag = 'GET { mint_keysets }';
		this.logger.debug(tag);
		return await this.mintKeysetService.getMintKeysets(tag);
	}

	@Query(() => [OrchardMintKeysetCount], {description: 'Get mint keyset proof and promise counts'})
	async mint_keyset_counts(
		@Args('date_start', {type: () => UnixTimestamp, nullable: true, description: 'Start of date range filter'})
		date_start?: number,
		@Args('date_end', {type: () => UnixTimestamp, nullable: true, description: 'End of date range filter'}) date_end?: number,
		@Args('id_keysets', {type: () => [String], nullable: true, description: 'Keyset IDs to filter by'}) id_keysets?: string[],
	): Promise<OrchardMintKeysetCount[]> {
		const tag = 'GET { mint_keyset_counts }';
		this.logger.debug(tag);
		return await this.mintKeysetService.getMintKeysetCounts(tag, {date_start, date_end, id_keysets});
	}

	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@UseInterceptors(MintKeysetInterceptor)
	@LogEvent({field: 'keyset', type: EventLogType.CREATE})
	@Mutation(() => OrchardMintKeysetRotation, {description: 'Rotate a mint keyset'})
	async mint_rotate_keyset(
		@Args('unit', {description: 'Currency unit for the new keyset'}) unit: string,
		@Args('amounts', {type: () => [Float], nullable: true, description: 'Denomination amounts for the keyset'}) amounts?: number[],
		@Args('input_fee_ppk', {type: () => Int, nullable: true, description: 'Input fee in parts per thousand'}) input_fee_ppk?: number,
		@Args('keyset_v2', {nullable: true, description: 'Whether to create a v2 keyset'}) keyset_v2?: boolean,
		@Args('final_expiry', {
			type: () => UnixTimestamp,
			nullable: true,
			description: 'NUT-02 final expiry — unix timestamp after which the mint stops honoring promises from this keyset',
		})
		final_expiry?: number | null,
	): Promise<OrchardMintKeysetRotation> {
		const tag = 'MUTATION { mint_rotate_keyset }';
		this.logger.debug(tag);
		return await this.mintKeysetService.mintRotateKeyset(tag, {unit, amounts, input_fee_ppk, keyset_v2, final_expiry});
	}
}
