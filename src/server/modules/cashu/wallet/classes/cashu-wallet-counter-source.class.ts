/* Vendor Dependencies */
import {DateTime} from 'luxon';
import type {Repository} from 'typeorm';
import type {CounterRange, CounterSource} from '@cashu/cashu-ts';
/* Native Dependencies */
import type {CashuWalletCounter} from '#server/modules/cashu/wallet/saga/cashuwalletcounter.entity';
import {getCounterKey} from '#server/modules/cashu/wallet/cashuwallet.helpers';

/**
 * One user's counter cursors in cashu_wallet_counters: NUT-13 keyset cursors for cashu-ts, and named ones like NUT-20 quote keys.
 * Each change is a single atomic statement, so a crash can waste counters but never reuse them.
 */
export class CashuWalletCounterSource implements CounterSource {
	constructor(
		private readonly repository: Repository<CashuWalletCounter>,
		private readonly user_id: string,
	) {}

	/** Claim the next n counters on a keyset's derivation path; n = 0 only reads the cursor */
	public reserve(keyset_id: string, n: number): Promise<CounterRange> {
		return this.reserveCursor(getCounterKey(keyset_id), n);
	}

	/** Move a keyset's cursor up to at least min_next; never down */
	public async advanceToAtLeast(keyset_id: string, min_next: number): Promise<void> {
		await this.upsert(getCounterKey(keyset_id), min_next, 'MAX(cashu_wallet_counters.next, excluded.next)');
	}

	/** Claim the next n counters of a cursor by key; n = 0 only reads it */
	public async reserveCursor(counter_key: string, n: number): Promise<CounterRange> {
		if (n === 0) {
			const row = await this.repository.findOneBy({user_id: this.user_id, counter_key});
			return {start: row?.next ?? 0, count: 0};
		}
		const next = await this.upsert(counter_key, n, 'cashu_wallet_counters.next + excluded.next');
		return {start: next - n, count: n};
	}

	/** Insert the cursor at `value`, or set it to `update` (SQL over the current and excluded rows); returns the new cursor */
	private async upsert(counter_key: string, value: number, update: string): Promise<number> {
		const rows: {next: number}[] = await this.repository.query(
			`INSERT INTO cashu_wallet_counters (user_id, counter_key, next, updated_at) VALUES (?, ?, ?, ?)
			ON CONFLICT(user_id, counter_key) DO UPDATE SET next = ${update}, updated_at = excluded.updated_at
			RETURNING next`,
			[this.user_id, counter_key, value, DateTime.now().toUnixInteger()],
		);
		return rows[0].next;
	}
}
