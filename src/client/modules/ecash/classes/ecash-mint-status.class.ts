import {OrchardEcashMintStatus} from '@shared/generated.types';

export class EcashMintStatus implements OrchardEcashMintStatus {
	mint_id: string;
	online: boolean;
	latency_ms: number | null;
	error: string | null;
	checked_at: number;

	constructor(oems: OrchardEcashMintStatus) {
		this.mint_id = oems.mint_id;
		this.online = oems.online;
		this.latency_ms = oems.latency_ms ?? null;
		this.error = oems.error ?? null;
		this.checked_at = oems.checked_at;
	}
}
