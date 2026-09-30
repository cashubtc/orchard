import {OrchardEcashSeed} from '@shared/generated.types';

export class EcashSeed implements OrchardEcashSeed {
	created_at: number;
	backed_up_at: number | null;

	constructor(oes: OrchardEcashSeed) {
		this.created_at = oes.created_at;
		this.backed_up_at = oes.backed_up_at ?? null;
	}
}
