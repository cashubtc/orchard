/** Coordinates configuration changes with active backfills and checkpoint rescans. */
export class AnalyticsLifecycle {
	private paused = false;
	private current_generation = 0;
	private active = new Set<Promise<void>>();

	/** Changes with every reset, so an identity fetched across a reconfiguration can be discarded. */
	public get generation(): number {
		return this.current_generation;
	}

	/** Track work so switching a node cannot reuse its identity midway through a write. */
	public async run(action: () => Promise<void>): Promise<void> {
		if (this.paused) return;
		const task = action();
		this.active.add(task);
		try {
			await task;
		} finally {
			this.active.delete(task);
		}
	}

	/** Stop at the next checkpoint boundary and drain already-started writes. */
	public async pause(): Promise<void> {
		this.paused = true;
		await Promise.allSettled([...this.active]);
	}

	/** Allow work after the connection has been replaced, invalidating identities fetched before. */
	public reset(): void {
		this.current_generation++;
		this.paused = false;
	}

	/** Interrupt the old run before it writes another checkpoint. */
	public assertActive(): void {
		if (this.paused) throw new Error('Analytics interrupted by a service configuration change');
	}
}
