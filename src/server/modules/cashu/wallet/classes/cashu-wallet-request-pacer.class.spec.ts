/* Core Dependencies */
import {expect} from '@jest/globals';
/* Local Dependencies */
import {CashuWalletRequestPacer} from './cashu-wallet-request-pacer.class.js';

describe('CashuWalletRequestPacer', () => {
	let pacer: CashuWalletRequestPacer;

	/** Start an acquire, reporting whether it has settled and how */
	const track = (host = 'mint.example') => {
		const outcome: {granted?: boolean} = {};
		void pacer.acquire(host).then((granted) => (outcome.granted = granted));
		return outcome;
	};

	beforeEach(() => {
		jest.useFakeTimers({now: 0});
		pacer = new CashuWalletRequestPacer(2, 60, 1_500);
	});

	afterEach(() => {
		jest.useRealTimers();
	});

	it('lets a burst through at once, spaces the next, and refuses one whose slot is further off than the longest wait', async () => {
		const outcomes = [track(), track(), track(), track()];
		await jest.advanceTimersByTimeAsync(0);
		expect(outcomes.map((outcome) => outcome.granted)).toEqual([true, true, undefined, false]);
		await jest.advanceTimersByTimeAsync(999);
		expect(outcomes[2].granted).toBeUndefined();
		await jest.advanceTimersByTimeAsync(1);
		expect(outcomes[2].granted).toBe(true);
	});

	it('paces each host on its own', async () => {
		track();
		track();
		const other = track('other.example');
		await jest.advanceTimersByTimeAsync(0);
		expect(other.granted).toBe(true);
	});

	it('holds a host until the mint is ready again, refusing what would wait too long', async () => {
		pacer.pause('mint.example', 1_000);
		const held = track();
		await jest.advanceTimersByTimeAsync(999);
		expect(held.granted).toBeUndefined();
		await jest.advanceTimersByTimeAsync(1);
		expect(held.granted).toBe(true);

		pacer.pause('mint.example', 60_000);
		const refused = track();
		await jest.advanceTimersByTimeAsync(0);
		expect(refused.granted).toBe(false);
	});

	it('never lets a shorter pause move a request ahead of those already waiting', async () => {
		track();
		track();
		track();
		pacer.pause('mint.example', 0);
		const next = track();
		await jest.advanceTimersByTimeAsync(0);
		expect(next.granted).toBe(false);
	});
});
