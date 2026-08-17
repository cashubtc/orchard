import {TaprootAssetVersion, TaprootAssetType} from '#server/modules/tapass/tapass.enums';

export type TaprootAssetsInfo = {
	version: string;
	lnd_version: string;
	network: string;
	lnd_identity_pubkey: string;
	node_alias: string;
	block_height: number;
	block_hash: string;
	sync_to_chain: boolean;
};

export type TaprootAssets = {
	assets: TaprootAsset[];
	unconfirmed_transfers: string;
	unconfirmed_mints: string;
};

export type TaprootAssetsUtxos = {
	managed_utxos: {
		[key: string]: {
			assets: TaprootAsset[];
			out_point: string;
			amt_sat: string;
			internal_key: Buffer;
			taproot_asset_root: Buffer;
			merkle_root: Buffer;
			lease_owner: Buffer;
			lease_expiry_unix: string;
		};
	};
};

export type TaprootAssetGroup = {
	raw_group_key: Buffer;
	tweaked_group_key: Buffer;
	asset_witness: Buffer;
	tapscript_root: Buffer;
};

export type TaprootAsset = {
	prev_witnesses: any[];
	version: TaprootAssetVersion;
	asset_genesis: {
		genesis_point: string;
		name: string;
		meta_hash: Buffer;
		asset_id: Buffer;
		asset_type: TaprootAssetType;
		output_index: number;
	};
	amount: string;
	lock_time: number;
	relative_lock_time: number;
	script_version: number;
	script_key: Buffer;
	script_key_is_local: boolean;
	asset_group: TaprootAssetGroup | null;
	chain_anchor: {
		anchor_tx: Buffer;
		anchor_block_hash: string;
		anchor_outpoint: string;
		internal_key: Buffer;
		merkle_root: Buffer;
		tapscript_sibling: Buffer;
		block_height: number;
		block_timestamp: string;
	};
	is_spent: boolean;
	lease_owner: Buffer;
	lease_expiry: string;
	is_burn: boolean;
	script_key_declared_known: boolean;
	script_key_has_script_path: boolean;
	decimal_display: {
		decimal_display: number;
	};
	script_key_type: string;
};

/* ── ListTransfers ── */

export type AssetTransferInput = {
	anchor_point: string;
	asset_id: Buffer;
	script_key: Buffer;
	amount: string;
};

export type AssetTransferOutputAnchor = {
	outpoint: string;
	value: string;
	internal_key: Buffer;
	taproot_asset_root: Buffer;
	merkle_root: Buffer;
	tapscript_sibling: Buffer;
	num_passive_assets: number;
	pk_script: Buffer;
};

export type AssetTransferOutput = {
	anchor: AssetTransferOutputAnchor;
	script_key: Buffer;
	script_key_is_local: boolean;
	amount: string;
	output_type: number;
	asset_version: number;
	lock_time: string;
	relative_lock_time: string;
	proof_delivery_status: number;
	asset_id: Buffer;
};

export type AssetTransfer = {
	transfer_timestamp: string;
	anchor_tx_hash: Buffer;
	anchor_tx_height_hint: number;
	anchor_tx_chain_fees: string;
	inputs: AssetTransferInput[];
	outputs: AssetTransferOutput[];
	anchor_tx_block_hash: {hash: Buffer; hash_str: string} | null;
	anchor_tx_block_height: number;
	label: string;
	anchor_tx: Buffer;
};

export type AssetTransfers = {
	transfers: AssetTransfer[];
};

/* ── AddrReceives ── */

export type TaprootAddr = {
	encoded: string;
	asset_id: Buffer;
	asset_type: number;
	amount: string;
	group_key: Buffer;
	script_key: Buffer;
	internal_key: Buffer;
};

export type AddrEvent = {
	creation_time_unix_seconds: string;
	addr: TaprootAddr;
	status: number;
	outpoint: string;
	utxo_amt_sat: string;
	taproot_sibling: Buffer;
	confirmation_height: number;
	has_proof: boolean;
};

export type AddrReceives = {
	events: AddrEvent[];
};
