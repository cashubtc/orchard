import {AnalyticsLifecycle} from './analytics-lifecycle.js';

describe('AnalyticsLifecycle', () => {
	it('drains the old write before allowing work on a new identity', async () => {
		const lifecycle = new AnalyticsLifecycle();
		let finish: () => void;
		const write = lifecycle.run(
			() =>
				new Promise<void>((resolve) => {
					finish = resolve;
				}),
		);
		let drained = false;
		const pause = lifecycle.pause().then(() => {
			drained = true;
		});
		await Promise.resolve();
		expect(drained).toBe(false);
		const next = jest.fn(async () => undefined);
		await lifecycle.run(next);
		expect(next).not.toHaveBeenCalled();
		expect(() => lifecycle.assertActive()).toThrow();
		finish();
		await write;
		await pause;
		const generation = lifecycle.generation;
		lifecycle.reset();
		expect(lifecycle.generation).not.toBe(generation);
		await lifecycle.run(next);
		expect(next).toHaveBeenCalledTimes(1);
	});
});
