/* Local Dependencies */
import {MintSwap} from './mint-swap.class';
/* Shared Dependencies */
import {OrchardMintSwap, MintUnit} from '@shared/generated.types';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const seed = (): OrchardMintSwap =>
	({
		operation_id: 'op-1',
		keyset_ids: ['ks-1'],
		unit: MintUnit.Sat,
		amount: 100,
		created_time: 1777503600,
		fee: 0,
	}) as unknown as OrchardMintSwap;

describe('MintSwap', () => {
	it('assigns a v4 uuid as id (works in non-secure-context browsers, unlike crypto.randomUUID)', () => {
		const swap = new MintSwap(seed());
		expect(swap.id).toMatch(UUID_V4_REGEX);
	});

	it('produces a unique id per instance', () => {
		const ids = new Set(Array.from({length: 100}, () => new MintSwap(seed()).id));
		expect(ids.size).toBe(100);
	});
});
