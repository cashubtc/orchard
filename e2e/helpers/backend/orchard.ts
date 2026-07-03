/**
 * Orchard server's own database reads. Distinct from the mint daemon's DB
 * — Orchard persists settings, oracle backfills, analytics checkpoints, and
 * users in `/app/data/orchard.db` (sqlite, WAL mode).
 */

/* Native Dependencies */
import {orchardDbQuery} from './_sql';
import type {ConfigInfo} from '@e2e/types/config';

export const orchard = {
	/** Latest oracle price stored by the Backfill Prices flow, in integer USD
	 *  per BTC (the `utxoracle.price` column). E.g. `50000` means $50,000/BTC.
	 *  Returns null if the table is empty — callers should already be gated
	 *  by `oracleHasRecentData` readiness, so a null here is a real failure. */
	oraclePrice(config: ConfigInfo): number | null {
		const out = orchardDbQuery(config, 'SELECT price FROM utxoracle ORDER BY date DESC LIMIT 1');
		if (out === '') return null;
		return parseInt(out, 10);
	},

	/** Count rows in Orchard's `events` table (the event log page's data
	 *  source), optionally windowed / filtered the same way the
	 *  `event_logs` resolver filters (`timestamp >= date_start`,
	 *  `timestamp <= date_end`, `status IN (...)` — event.service.ts).
	 *  Timestamps are unix seconds (`toUnixInteger`). NOT cached: every
	 *  operator action appends rows mid-run. */
	eventCount(config: ConfigInfo, opts: {date_start?: number; date_end?: number; statuses?: string[]} = {}): number {
		const where: string[] = [];
		if (opts.date_start !== undefined) where.push(`timestamp >= ${Math.floor(opts.date_start)}`);
		if (opts.date_end !== undefined) where.push(`timestamp <= ${Math.floor(opts.date_end)}`);
		if (opts.statuses && opts.statuses.length > 0) {
			const quoted = opts.statuses.map((s) => `'${s.replace(/'/g, "''")}'`).join(', ');
			where.push(`status IN (${quoted})`);
		}
		const sql = `SELECT COUNT(*) FROM events${where.length ? ` WHERE ${where.join(' AND ')}` : ''}`;
		return parseInt(orchardDbQuery(config, sql), 10);
	},

	/** Earliest event timestamp (unix seconds) — what the
	 *  `event_log_genesis` resolver returns for the date presets.
	 *  Null when the log is empty. */
	eventGenesis(config: ConfigInfo): number | null {
		const out = orchardDbQuery(config, 'SELECT MIN(timestamp) FROM events');
		if (out === '') return null;
		return parseInt(out, 10);
	},
};
