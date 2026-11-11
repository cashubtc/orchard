/** Paces requests per mint host (GCRA: a burst, then a steady rate), since every wallet on an instance shares one IP */
export class CashuWalletRequestPacer {
	private readonly arrivals = new Map<string, number>();
	private readonly interval_ms: number;
	private readonly tolerance_ms: number;

	constructor(
		burst: number,
		per_minute: number,
		private readonly max_wait_ms: number,
	) {
		this.interval_ms = 60_000 / per_minute;
		this.tolerance_ms = (burst - 1) * this.interval_ms;
	}

	/** Claim a host's next slot and wait for it; false at once when it's further off than the longest wait */
	public async acquire(host: string): Promise<boolean> {
		const now = Date.now();
		const arrival = Math.max(this.arrivals.get(host) ?? now, now);
		const wait_ms = arrival - this.tolerance_ms - now;
		if (wait_ms > this.max_wait_ms) return false;
		this.arrivals.set(host, arrival + this.interval_ms);
		if (wait_ms > 0) await new Promise((resolve) => setTimeout(resolve, wait_ms));
		return true;
	}

	/** Hold a host's requests until the mint is ready for them again */
	public pause(host: string, retry_after_ms: number): void {
		const now = Date.now();
		this.arrivals.set(host, Math.max(this.arrivals.get(host) ?? now, now + retry_after_ms + this.tolerance_ms));
	}
}
