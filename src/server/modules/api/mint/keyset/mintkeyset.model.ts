/* Core Dependencies */
import {Field, Int, Float, ID, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {UnixTimestamp} from '@server/modules/graphql/scalars/unixtimestamp.scalar';
import {CashuMintKeyset} from '@server/modules/cashu/mintdb/cashumintdb.types';
import {MintUnit} from '@server/modules/cashu/cashu.enums';

@ObjectType({description: 'Cashu mint keyset configuration'})
export class OrchardMintKeyset {
	@Field(() => ID, {description: 'Keyset ID'})
	id: string;

	@Field({description: 'BIP-32 derivation path'})
	derivation_path: string;

	@Field(() => Int, {description: 'Index within the derivation path'})
	derivation_path_index: number;

	@Field(() => UnixTimestamp, {nullable: true, description: 'Timestamp when the keyset becomes valid'})
	valid_from: number;

	@Field(() => UnixTimestamp, {nullable: true, description: 'Timestamp when the keyset expires'})
	valid_to: number;

	@Field(() => UnixTimestamp, {
		nullable: true,
		description: 'NUT-02 final expiry — unix timestamp after which the mint no longer honors promises from this keyset',
	})
	final_expiry: number;

	@Field({description: 'Whether the keyset is currently active'})
	active: boolean;

	@Field({description: 'Currency unit of the keyset'})
	unit: MintUnit;

	@Field(() => Int, {nullable: true, description: 'Input fee in parts per thousand'})
	input_fee_ppk: number;

	@Field(() => Int, {description: 'Total fees paid for this keyset'})
	fees_paid: number;

	@Field(() => [Float], {nullable: true, description: 'Denomination amounts in the keyset'})
	amounts: number[];

	constructor(cashu_keyset: CashuMintKeyset) {
		this.id = cashu_keyset.id;
		this.derivation_path = cashu_keyset.derivation_path;
		this.derivation_path_index = cashu_keyset.derivation_path_index;
		this.valid_from = cashu_keyset.valid_from;
		this.valid_to = cashu_keyset.valid_to;
		this.final_expiry = cashu_keyset.final_expiry;
		this.active = !!cashu_keyset.active;
		this.unit = cashu_keyset.unit;
		this.input_fee_ppk = cashu_keyset.input_fee_ppk;
		this.fees_paid = cashu_keyset.fees_paid ?? 0;
		this.amounts = typeof cashu_keyset.amounts === 'string' ? JSON.parse(cashu_keyset.amounts) : (cashu_keyset.amounts ?? []);
	}
}

@ObjectType({description: 'Result of a keyset rotation'})
export class OrchardMintKeysetRotation {
	@Field({description: 'New keyset ID'})
	id: string;

	@Field({description: 'Currency unit of the rotated keyset'})
	unit: string;

	@Field(() => [Float], {nullable: true, description: 'Denomination amounts in the new keyset'})
	amounts: number[];

	@Field(() => Int, {nullable: true, description: 'Input fee in parts per thousand'})
	input_fee_ppk: number;
}

@ObjectType({description: 'Cashu mint keyset proof and promise counts'})
export class OrchardMintKeysetCount {
	@Field(() => ID, {description: 'Keyset ID'})
	id: string;

	@Field(() => Int, {description: 'Number of proofs for this keyset'})
	proof_count: number;

	@Field(() => Int, {description: 'Number of promises for this keyset'})
	promise_count: number;

	constructor(cashu_keyset_count: {id: string; proof_count: number; promise_count: number}) {
		this.id = cashu_keyset_count.id;
		this.proof_count = cashu_keyset_count.proof_count;
		this.promise_count = cashu_keyset_count.promise_count;
	}
}
