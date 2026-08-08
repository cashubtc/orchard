/* Core Dependencies */
import {Field, Int, Float, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import type {TaprootAssetsUtxos, TaprootAsset, TaprootAssets, TaprootAssetGroup} from '#server/modules/tapass/tapass/tapass.types';
import {TaprootAssetType, TaprootAssetVersion} from '#server/modules/tapass/tapass.enums';
import {Base64} from '#server/modules/graphql/scalars/base64.scalar';

@ObjectType({description: 'Taproot asset decimal display configuration'})
export class OrchardTaprootAssetDecimalDisplay {
	@Field(() => Int, {description: 'Number of decimal places for display'})
	decimal_display: number;

	constructor(decimal_display: TaprootAsset['decimal_display']) {
		this.decimal_display = decimal_display.decimal_display;
	}
}

@ObjectType({description: 'Taproot asset genesis information'})
export class OrchardTaprootAssetGenesis {
	@Field(() => String, {description: 'Genesis outpoint of the asset'})
	genesis_point: string;

	@Field(() => String, {description: 'Asset name'})
	name: string;

	@Field(() => Base64, {description: 'Unique asset identifier'})
	asset_id: string;

	@Field(() => TaprootAssetType, {description: 'Type of the Taproot asset'})
	asset_type: TaprootAssetType;

	@Field(() => Int, {description: 'Output index in the genesis transaction'})
	output_index: number;

	constructor(asset_genesis: TaprootAsset['asset_genesis']) {
		this.genesis_point = asset_genesis.genesis_point;
		this.name = asset_genesis.name;
		this.asset_id = asset_genesis.asset_id.toString('base64');
		this.asset_type = asset_genesis.asset_type;
		this.output_index = asset_genesis.output_index;
	}
}

@ObjectType({description: 'Taproot asset group key information'})
export class OrchardTaprootAssetGroup {
	@Field(() => Base64, {description: 'Raw group key before tweaking'})
	raw_group_key: string;

	@Field(() => Base64, {description: 'Tweaked group key'})
	tweaked_group_key: string;

	@Field(() => Base64, {description: 'Witness data for group membership'})
	asset_witness: string;

	@Field(() => Base64, {description: 'Tapscript root hash'})
	tapscript_root: string;

	constructor(group: TaprootAssetGroup) {
		this.raw_group_key = group.raw_group_key.toString('base64');
		this.tweaked_group_key = group.tweaked_group_key.toString('base64');
		this.asset_witness = group.asset_witness.toString('base64');
		this.tapscript_root = group.tapscript_root.toString('base64');
	}
}

@ObjectType({description: 'Taproot asset definition'})
export class OrchardTaprootAsset {
	@Field(() => TaprootAssetVersion, {description: 'Asset version'})
	version: TaprootAssetVersion;

	@Field(() => String, {description: 'Asset amount'})
	amount: string;

	@Field(() => OrchardTaprootAssetGroup, {nullable: true, description: 'Asset group information'})
	asset_group: OrchardTaprootAssetGroup | null;

	@Field(() => Boolean, {description: 'Whether the asset has been spent'})
	is_spent: boolean;

	@Field(() => Boolean, {description: 'Whether the asset has been burned'})
	is_burn: boolean;

	@Field(() => OrchardTaprootAssetGenesis, {description: 'Genesis information for the asset'})
	asset_genesis: OrchardTaprootAssetGenesis;

	@Field(() => OrchardTaprootAssetDecimalDisplay, {description: 'Decimal display configuration'})
	decimal_display: OrchardTaprootAssetDecimalDisplay;

	constructor(asset: TaprootAsset) {
		this.version = asset.version;
		this.amount = asset.amount;
		this.asset_group = asset.asset_group ? new OrchardTaprootAssetGroup(asset.asset_group) : null;
		this.is_spent = asset.is_spent;
		this.is_burn = asset.is_burn;
		this.asset_genesis = new OrchardTaprootAssetGenesis(asset.asset_genesis);
		this.decimal_display = new OrchardTaprootAssetDecimalDisplay(asset.decimal_display);
	}
}

@ObjectType({description: 'Taproot assets collection with pending status'})
export class OrchardTaprootAssets {
	@Field(() => [OrchardTaprootAsset], {description: 'List of Taproot assets'})
	assets: OrchardTaprootAsset[];

	@Field(() => String, {description: 'Unconfirmed transfers count'})
	unconfirmed_transfers: string;

	@Field(() => String, {description: 'Unconfirmed mints count'})
	unconfirmed_mints: string;

	constructor(ta_assets: TaprootAssets) {
		this.assets = ta_assets.assets.map((asset) => new OrchardTaprootAsset(asset));
		this.unconfirmed_transfers = ta_assets.unconfirmed_transfers;
		this.unconfirmed_mints = ta_assets.unconfirmed_mints;
	}
}

@ObjectType({description: 'Taproot asset UTXO'})
export class OrchardTaprootAssetsUtxo {
	@Field(() => String, {description: 'UTXO outpoint identifier'})
	id: string;

	@Field(() => Float, {description: 'UTXO amount in satoshis'})
	amt_sat: number;

	@Field(() => [OrchardTaprootAsset], {description: 'Assets contained in this UTXO'})
	assets: OrchardTaprootAsset[];

	constructor(ta_utxo: TaprootAssetsUtxos['managed_utxos'][string], key: string) {
		this.id = key;
		this.amt_sat = Number(ta_utxo.amt_sat);
		this.assets = ta_utxo.assets.map((asset) => new OrchardTaprootAsset(asset));
	}
}
