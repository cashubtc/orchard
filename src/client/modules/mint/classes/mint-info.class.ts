import {OrchardContact, OrchardMintInfo, OrchardNuts} from '@shared/generated.types';

export class MintInfo implements OrchardMintInfo {
	name: string | null;
	pubkey: string | null;
	version: string;
	description: string | null;
	description_long: string | null;
	contact: OrchardContact[] | null;
	icon_url: string | null;
	tos_url: string | null;
	urls: string[] | null;
	time: number | null;
	nuts: OrchardNuts;

	constructor(omi: OrchardMintInfo) {
		this.name = omi.name ?? null;
		this.pubkey = omi.pubkey ?? null;
		this.version = omi.version;
		this.description = omi.description ?? null;
		this.description_long = omi.description_long ?? null;
		this.contact = omi.contact ?? null;
		this.icon_url = omi.icon_url ?? null;
		this.tos_url = omi.tos_url ?? null;
		this.urls = omi.urls ?? null;
		this.time = omi.time ?? null;
		this.nuts = omi.nuts;
	}
}
