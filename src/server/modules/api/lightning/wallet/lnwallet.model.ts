/* Core Dependencies */
import {Field, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import {LightningAddressType} from '#server/modules/lightning/lightning.enums';
import type {LightningAddresses} from '#server/modules/lightning/walletkit/lnwalletkit.types';
import {Base64} from '#server/modules/graphql/scalars/base64.scalar';

@ObjectType({description: 'Lightning wallet address'})
export class OrchardLightningAddress {
	@Field(() => String, {description: 'On-chain wallet address'})
	address: string;

	@Field(() => String, {description: 'Internal (change) or external (receiving) address indicator'})
	is_internal: string;

	@Field(() => Number, {description: 'Balance held at this address in satoshis'})
	balance: number;

	@Field(() => String, {description: 'BIP derivation path of the address'})
	derivation_path: string;

	@Field(() => Base64, {description: 'Public key associated with this address'})
	public_key: string;

	constructor(address: LightningAddresses['account_with_addresses'][number]['addresses'][number]) {
		this.address = address.address;
		this.is_internal = address.is_internal;
		this.balance = address.balance;
		this.derivation_path = address.derivation_path;
		this.public_key = address.public_key.toString('base64');
	}
}

@ObjectType({description: 'Lightning wallet account'})
export class OrchardLightningAccount {
	@Field(() => String, {description: 'Account name'})
	name: string;

	@Field(() => LightningAddressType, {description: 'Address type used by this account'})
	address_type: LightningAddressType;

	@Field(() => String, {description: 'BIP derivation path of the account'})
	derivation_path: string;

	@Field(() => [OrchardLightningAddress], {description: 'Addresses belonging to this account'})
	addresses: OrchardLightningAddress[];

	constructor(account: LightningAddresses['account_with_addresses'][number]) {
		this.name = account.name;
		this.address_type = account.address_type;
		this.derivation_path = account.derivation_path;
		this.addresses = account.addresses.map((address) => new OrchardLightningAddress(address));
	}
}
