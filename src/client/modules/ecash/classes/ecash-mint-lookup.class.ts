/* Application Dependencies */
import {MintInfo} from '@client/modules/mint/classes/mint-info.class';
/* Shared Dependencies */
import {OrchardEcashMintLookup, WalletMintMatch} from '@shared/generated.types';

export class EcashMintLookup implements OrchardEcashMintLookup {
	url: string;
	info: MintInfo | null;
	latency_ms: number | null;
	time_offset: number | null;
	match: WalletMintMatch | null;
	mint_id: string | null;

	constructor(oeml: OrchardEcashMintLookup) {
		this.url = oeml.url;
		this.info = oeml.info ? new MintInfo(oeml.info) : null;
		this.latency_ms = oeml.latency_ms ?? null;
		this.time_offset = oeml.time_offset ?? null;
		this.match = oeml.match ?? null;
		this.mint_id = oeml.mint_id ?? null;
	}
}
