/* Vendor Dependencies */
import {NetworkError} from '@cashu/cashu-ts';

/** A mint request Orchard held back before sending, so this attempt never reached the mint */
export class CashuWalletUnsentError extends NetworkError {
	constructor(message: string) {
		super(message);
		// NetworkError pins its own prototype, which would hide this subclass from instanceof
		Object.setPrototypeOf(this, CashuWalletUnsentError.prototype);
		this.name = 'CashuWalletUnsentError';
	}
}
