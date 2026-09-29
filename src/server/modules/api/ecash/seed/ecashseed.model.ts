/* Core Dependencies */
import {Field, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '#server/modules/graphql/scalars/unixtimestamp.scalar';
import type {CashuWalletSeedStatus} from '#server/modules/cashu/wallet/cashuwallet.types';

@ObjectType({description: "Backup status of the current user's ecash wallet seed"})
export class OrchardEcashSeed {
	@Field(() => UnixTimestamp, {description: 'When the seed was created'})
	created_at: number;

	@Field(() => UnixTimestamp, {nullable: true, description: 'When the user confirmed backing up the mnemonic'})
	backed_up_at: number | null;

	constructor(seed: CashuWalletSeedStatus) {
		this.created_at = seed.created_at;
		this.backed_up_at = seed.backed_up_at;
	}
}
