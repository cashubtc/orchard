import {LightningAddressType} from '#server/modules/lightning/lightning.enums';

export type LightningAddresses = {
	account_with_addresses: {
		name: string;
		address_type: LightningAddressType;
		derivation_path: string;
		addresses: {
			address: string;
			is_internal: string;
			balance: number;
			derivation_path: string;
			public_key: Buffer;
		}[];
	}[];
};
