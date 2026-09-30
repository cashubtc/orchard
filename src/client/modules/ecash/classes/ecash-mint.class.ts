import {OrchardEcashMint} from '@shared/generated.types';

export class EcashMint implements OrchardEcashMint {
	id: string;
	urls: string[];
	name: string | null;
	pubkey: string | null;
	icon_url: string | null;
	units: string[];
	is_orchard: boolean;
	created_at: number;

	constructor(oem: OrchardEcashMint) {
		this.id = oem.id;
		this.urls = oem.urls;
		this.name = oem.name ?? null;
		this.pubkey = oem.pubkey ?? null;
		this.icon_url = oem.icon_url ?? null;
		this.units = oem.units;
		this.is_orchard = oem.is_orchard;
		this.created_at = oem.created_at;
	}
}
