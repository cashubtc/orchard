/* Core Dependencies */
import {Field, ObjectType, Float, Int} from '@nestjs/graphql';
/* Application Dependencies */
import {LightningChannel, LightningClosedChannel, LightningChannelAsset} from '#server/modules/lightning/lightning/lightning.types';
import {LightningChannelCloseType, LightningChannelOpenInitiator} from '#server/modules/lightning/lightning.enums';

@ObjectType({description: 'Taproot asset associated with a lightning channel'})
export class OrchardLightningChannelAsset {
	@Field(() => String, {description: 'Taproot asset group key'})
	group_key: string;

	@Field(() => String, {description: 'Unique identifier of the asset'})
	asset_id: string;

	@Field(() => String, {description: 'Human-readable name of the asset'})
	name: string;

	@Field(() => Float, {description: 'Local balance of the asset in the channel'})
	local_balance: number;

	@Field(() => Float, {description: 'Remote balance of the asset in the channel'})
	remote_balance: number;

	@Field(() => Float, {description: 'Total asset capacity in the channel'})
	capacity: number;

	@Field(() => Float, {description: 'Number of decimal places for display'})
	decimal_display: number;

	constructor(asset: LightningChannelAsset) {
		this.group_key = asset.group_key;
		this.asset_id = asset.asset_id;
		this.name = asset.name;
		this.local_balance = parseFloat(asset.local_balance);
		this.remote_balance = parseFloat(asset.remote_balance);
		this.capacity = parseFloat(asset.capacity);
		this.decimal_display = asset.decimal_display;
	}
}

@ObjectType({description: 'Lightning channel information'})
export class OrchardLightningChannel {
	@Field(() => String, {description: 'Outpoint of the funding transaction'})
	channel_point: string;

	@Field(() => String, {description: 'Unique channel identifier'})
	chan_id: string;

	@Field(() => Float, {description: 'Channel capacity in satoshis'})
	capacity: number;

	@Field(() => Float, {description: 'Local balance in satoshis'})
	local_balance: number;

	@Field(() => Float, {description: 'Remote balance in satoshis'})
	remote_balance: number;

	@Field(() => Boolean, {nullable: true, description: 'Whether the local node initiated the channel open'})
	initiator: boolean | null;

	@Field(() => Float, {nullable: true, description: 'Amount pushed to the remote peer on open in satoshis'})
	push_amount_sat: number | null;

	@Field(() => Boolean, {description: 'Whether the channel is private'})
	private: boolean;

	@Field(() => Boolean, {description: 'Whether the channel is currently active'})
	active: boolean;

	@Field(() => String, {description: 'Public key of the remote peer'})
	remote_pubkey: string;

	@Field(() => String, {nullable: true, description: 'Alias of the remote peer'})
	peer_alias: string | null;

	@Field(() => String, {description: 'Transaction ID of the funding transaction'})
	funding_txid: string;

	@Field(() => OrchardLightningChannelAsset, {nullable: true, description: 'Taproot asset associated with this channel'})
	asset: OrchardLightningChannelAsset | null;

	constructor(channel: LightningChannel) {
		this.channel_point = channel.channel_point;
		this.chan_id = channel.chan_id;
		this.capacity = parseFloat(channel.capacity);
		this.local_balance = parseFloat(channel.local_balance);
		this.remote_balance = parseFloat(channel.remote_balance);
		this.initiator = channel.initiator;
		this.push_amount_sat = channel.push_amount_sat ? parseFloat(channel.push_amount_sat) : null;
		this.private = channel.private;
		this.active = channel.active;
		this.remote_pubkey = channel.remote_pubkey;
		this.peer_alias = channel.peer_alias;
		this.funding_txid = channel.funding_txid;
		this.asset = channel.asset ? new OrchardLightningChannelAsset(channel.asset) : null;
	}
}

@ObjectType({description: 'Closed lightning channel information'})
export class OrchardLightningClosedChannel {
	@Field(() => String, {description: 'Outpoint of the funding transaction'})
	channel_point: string;

	@Field(() => String, {description: 'Unique channel identifier'})
	chan_id: string;

	@Field(() => Float, {description: 'Channel capacity in satoshis'})
	capacity: number;

	@Field(() => Int, {description: 'Block height at which the channel was closed'})
	close_height: number;

	@Field(() => Float, {description: 'Settled balance in satoshis at close'})
	settled_balance: number;

	@Field(() => Float, {nullable: true, description: 'Time-locked balance in satoshis awaiting maturity'})
	time_locked_balance: number | null;

	@Field(() => LightningChannelCloseType, {description: 'How the channel was closed'})
	close_type: LightningChannelCloseType;

	@Field(() => LightningChannelOpenInitiator, {description: 'Which side initiated the channel open'})
	open_initiator: LightningChannelOpenInitiator;

	@Field(() => String, {description: 'Public key of the remote peer'})
	remote_pubkey: string;

	@Field(() => String, {description: 'Transaction ID of the funding transaction'})
	funding_txid: string;

	@Field(() => String, {description: 'Transaction ID of the closing transaction'})
	closing_txid: string;

	@Field(() => OrchardLightningChannelAsset, {nullable: true, description: 'Taproot asset associated with this channel'})
	asset: OrchardLightningChannelAsset | null;

	constructor(channel: LightningClosedChannel) {
		this.channel_point = channel.channel_point;
		this.chan_id = channel.chan_id;
		this.capacity = parseFloat(channel.capacity);
		this.close_height = channel.close_height;
		this.settled_balance = parseFloat(channel.settled_balance);
		this.time_locked_balance = channel.time_locked_balance ? parseFloat(channel.time_locked_balance) : null;
		this.close_type = channel.close_type;
		this.open_initiator = channel.open_initiator;
		this.remote_pubkey = channel.remote_pubkey;
		this.funding_txid = channel.funding_txid;
		this.closing_txid = channel.closing_txid;
		this.asset = channel.asset ? new OrchardLightningChannelAsset(channel.asset) : null;
	}
}
