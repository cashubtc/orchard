/* Core Dependencies */
import {Field, ObjectType, Float} from '@nestjs/graphql';
/* Application Dependencies */
import type {LightningPeer} from '#server/modules/lightning/lightning/lightning.types';

@ObjectType({description: 'Lightning network peer information'})
export class OrchardLightningPeer {
	@Field(() => String, {description: 'Public key of the peer'})
	pubkey: string;

	@Field(() => String, {nullable: true, description: 'Alias of the peer'})
	alias: string | null;

	@Field(() => String, {description: 'Network address of the peer'})
	address: string;

	@Field(() => Float, {nullable: true, description: 'Total bytes sent to this peer'})
	bytes_sent: number | null;

	@Field(() => Float, {nullable: true, description: 'Total bytes received from this peer'})
	bytes_recv: number | null;

	@Field(() => Float, {nullable: true, description: 'Total satoshis sent to this peer'})
	sat_sent: number | null;

	@Field(() => Float, {nullable: true, description: 'Total satoshis received from this peer'})
	sat_recv: number | null;

	@Field(() => Boolean, {nullable: true, description: 'Whether the peer connection was inbound'})
	inbound: boolean | null;

	@Field(() => Float, {nullable: true, description: 'Last measured ping time in microseconds'})
	ping_time: number | null;

	constructor(peer: LightningPeer) {
		this.pubkey = peer.pubkey;
		this.alias = peer.alias;
		this.address = peer.address;
		this.bytes_sent = peer.bytes_sent != null ? parseFloat(peer.bytes_sent) : null;
		this.bytes_recv = peer.bytes_recv != null ? parseFloat(peer.bytes_recv) : null;
		this.sat_sent = peer.sat_sent != null ? parseFloat(peer.sat_sent) : null;
		this.sat_recv = peer.sat_recv != null ? parseFloat(peer.sat_recv) : null;
		this.inbound = peer.inbound;
		this.ping_time = peer.ping_time;
	}
}
