/* Vendor Dependencies */
import {NetworkError} from '@cashu/cashu-ts';

/** A mint endpoint answered with a redirect, which mint requests never follow; `location` is where it points, when it says */
export class MintRedirectError extends NetworkError {
	public readonly location: string | null;

	constructor(endpoint: string, location: string | null) {
		super(`${endpoint}: redirects to ${location ?? 'an unstated location'}`);
		// NetworkError pins its own prototype, which would hide this subclass from instanceof
		Object.setPrototypeOf(this, MintRedirectError.prototype);
		this.name = 'MintRedirectError';
		this.location = location;
	}
}
