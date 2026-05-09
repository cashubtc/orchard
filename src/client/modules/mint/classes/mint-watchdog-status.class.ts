/* Core Dependencies */
import {OrchardMintWatchdogStatus} from '@shared/generated.types';

export class MintWatchdogStatus implements OrchardMintWatchdogStatus {
	public is_alive: boolean;
	public last_seen: number | null;

	constructor(omws: OrchardMintWatchdogStatus) {
		this.is_alive = omws.is_alive;
		this.last_seen = omws.last_seen ?? null;
	}
}
