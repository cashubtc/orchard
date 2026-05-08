/**
 * Mint daemon source-of-truth reads. NUT-06 `/v1/info` via docker-exec curl/wget;
 * balances/fees/keysets via the daemon's database (cdk: postgres or sqlite,
 * nutshell: postgres or sqlite). Differential oracle for the bs spec.
 */

/* Native Dependencies */
import {dockerExec} from './docker-cli';
import {cached, recache} from './_cache';
import {mintDbQuery, parseSqlBoolean} from './_sql';
import type {ConfigInfo, MintUnit} from '@e2e/types/config';
import type {MintNutInfo} from '@e2e/types/mint';

export const mint = {
	/** Read mint state straight from the daemon. Both nutshell and cdk
	 *  expose NUT-06 at `/v1/info` over their in-container loopback port,
	 *  reachable via docker exec. */
	getInfo(config: ConfigInfo, options: {fresh?: boolean} = {}): MintNutInfo {
		// 127.0.0.1 not localhost — cdk-mintd's container has no `localhost`
		// entry in /etc/hosts. nutshell ships curl, cdk-mintd ships wget;
		// `sh -c` chains so the call survives whichever tool is in $PATH.
		const fetchInfo = () => {
			const url = `http://127.0.0.1:${config.mintPort}/v1/info`;
			const cmd = `curl -fsS ${url} 2>/dev/null || wget -qO- ${url}`;
			const out = dockerExec(['exec', config.containers.mint, 'sh', '-c', cmd]);
			return JSON.parse(out) as MintNutInfo;
		};
		// `fresh` skips the cache (and overwrites it) — use after a UI-driven
		// mutation that just changed `/v1/info` so the next cached read sees
		// the new value too.
		const key = `mint.getInfo:${config.name}`;
		if (options.fresh) return recache(key, fetchInfo);
		return cached(key, fetchInfo);
	},

	/** Outstanding ecash liability for the given mint unit, summed across all
	 *  keysets of that unit, straight from the mint database — what
	 *  `orc-mint-general-balance-sheet` displays as the row's liabilities
	 *  figure (the component's `getRows` aggregates per-keyset values into
	 *  one row per unit the same way). NOT cached: ecash supply mutates as
	 *  tests mint/melt; this is the differential oracle the spec asserts UI
	 *  values against.
	 *
	 *  cdk: `keyset_amounts.total_issued - total_redeemed` (matches Orchard's
	 *  `getBalances` resolver in `cdk.service.ts`), joined to `keyset` for unit.
	 *  nutshell: the `balance` view (defined as `s_issued - s_used`), keyed
	 *  by `keyset`, joined to `keysets` for unit. */
	balance(config: ConfigInfo, unit: MintUnit): number {
		const sql =
			config.mint === 'cdk'
				? `SELECT COALESCE(SUM(total_issued - total_redeemed), 0) FROM keyset_amounts ka JOIN keyset k ON k.id = ka.keyset_id WHERE k.unit = '${unit}'`
				: `SELECT COALESCE(SUM(b.balance), 0) FROM balance b JOIN keysets k ON k.id = b.keyset WHERE k.unit = '${unit}'`;
		const out = mintDbQuery(config, sql);
		return parseInt(out, 10);
	},

	/** Total fees the mint has collected for the given unit, summed across all
	 *  its keysets, straight from the mint database — what
	 *  `orc-mint-general-balance-sheet` displays in the expanded row's
	 *  "Fee revenue" high-card (the component's `getRows` aggregates per-keyset
	 *  `keyset.fees_paid` into one row per unit the same way). NOT cached:
	 *  fees grow as melts/swaps land mid-test.
	 *
	 *  cdk: `keyset_amounts.fee_collected`, joined to `keyset` for unit
	 *  (matches Orchard's `getKeysets` resolver, which selects this column
	 *  aliased as `fees_paid`).
	 *  nutshell: the `keysets` table carries `fees_paid` directly. */
	feesPaid(config: ConfigInfo, unit: MintUnit): number {
		const sql =
			config.mint === 'cdk'
				? `SELECT COALESCE(SUM(ka.fee_collected), 0) FROM keyset_amounts ka JOIN keyset k ON k.id = ka.keyset_id WHERE k.unit = '${unit}'`
				: `SELECT COALESCE(SUM(fees_paid), 0) FROM keysets WHERE unit = '${unit}'`;
		const out = mintDbQuery(config, sql);
		return parseInt(out, 10);
	},

	/** Provisioned keysets straight from the mint database, in the same shape
	 *  the bs row-chip renders (`Gen N` + `NNN ppk`). NOT cached: rotation can
	 *  add new keysets mid-test.
	 *
	 *  cdk stores the parsed `derivation_path_index` as its own column; nutshell
	 *  only stores the full `derivation_path` and Orchard's nutshell service
	 *  extracts the trailing `/N'?$` segment as the index — this helper mirrors
	 *  that extraction. The legacy-keyset reconciler (`reconcileLegacyKeysetIndices`)
	 *  in nutshell.service.ts only kicks in for keysets with `valid_from = null`,
	 *  which the regtest fixtures don't produce, so the simple regex matches
	 *  Orchard's output for every keyset in test stacks. */
	keysets(config: ConfigInfo): Array<{
		id: string;
		unit: MintUnit;
		active: boolean;
		derivation_path_index: number;
		input_fee_ppk: number;
	}> {
		const sql =
			config.mint === 'cdk'
				? `SELECT id, unit, active, derivation_path_index, COALESCE(input_fee_ppk, 0) FROM keyset ORDER BY id`
				: `SELECT id, unit, active, derivation_path, COALESCE(input_fee_ppk, 0) FROM keysets ORDER BY id`;
		const out = mintDbQuery(config, sql);
		if (out === '') return [];
		return out.split('\n').map((line) => {
			const [id, unit, active_str, third, ppk_str] = line.split('|');
			// cdk's third column is the parsed index; nutshell's is the full path
			// and Orchard extracts the trailing `/N'?` segment as the index.
			const nutshell_match = third.match(/\/(\d+)'?$/);
			const derivation_path_index =
				config.mint === 'cdk' ? parseInt(third, 10) : nutshell_match ? parseInt(nutshell_match[1], 10) : 0;
			return {
				id,
				unit: unit as MintUnit,
				active: parseSqlBoolean(active_str),
				derivation_path_index,
				input_fee_ppk: parseInt(ppk_str, 10),
			};
		});
	},

	/** Differential oracle for `orc-mint-general-keysets`'s Blind sigs +
	 *  Proofs counts. Mirrors the analytics-archive math the server runs
	 *  in `MintKeysetService.getMintKeysetCounts` (mintkeyset.service.ts:42)
	 *  — but reads the mint daemon's DB directly, ceiling'd to the
	 *  cache's coverage window so the comparison is meaningful even when
	 *  backfill hasn't fully caught up.
	 *
	 *  Window. The card's totals come from
	 *  `cashuMintAnalyticsService.getCachedAnalytics({metrics:
	 *  [keyset_issued, keyset_redeemed]})` with no date filter — i.e. the
	 *  sum across every hour-bucket the archive has stored. Backfill
	 *  buckets each row by `startOfHour(created_time, UTC)` and skips any
	 *  bucket `>= current_hour` (mintanalytics.service.ts:248-249), so
	 *  the archive only ever holds completed hours. The latest archived
	 *  hour from `mint_analytics_recent` is therefore the most recent
	 *  hour bucket whose rows have been counted.
	 *
	 *  Caller passes `last_processed_at` (the same `latestMintCacheHour`
	 *  derivation the activity card spec uses) and the oracle counts
	 *  daemon-DB rows whose `created_time` falls strictly before the end
	 *  of that bucket — `created_time < last_processed_at + 3600`. UI
	 *  reading == oracle when backfill has run end-to-end through the
	 *  ceiling hour.
	 *
	 *  cdk: row-level `proof.created_time` and `blind_signature.created_time`
	 *  (epoch seconds INTEGER on both sqlite and postgres — direct
	 *  comparison). nutshell: `proofs_used.created` and `promises.created`,
	 *  INTEGER on sqlite but TIMESTAMP on postgres — the helper extracts
	 *  the epoch from the timestamp the same way `activitySummaryOracle`
	 *  does for `mint_quotes` / `melt_quotes`. */
	keysetCountsOracle(
		config: ConfigInfo,
		options: {last_processed_at: number},
	): {total_promises: number; total_proofs: number; window: {effective_end: number}} {
		const effective_end = options.last_processed_at + 3600;
		if (effective_end <= 0) return {total_promises: 0, total_proofs: 0, window: {effective_end}};

		const isNutshellPostgres = config.mint === 'nutshell' && config.db === 'postgres';
		const timeCol = (column: string): string => (isNutshellPostgres ? `EXTRACT(EPOCH FROM ${column})` : column);

		const promises_sql =
			config.mint === 'cdk'
				? `SELECT COUNT(*) FROM blind_signature WHERE created_time < ${effective_end}`
				: `SELECT COUNT(*) FROM promises WHERE ${timeCol('created')} < ${effective_end}`;
		const proofs_sql =
			config.mint === 'cdk'
				? `SELECT COUNT(*) FROM proof WHERE created_time < ${effective_end}`
				: `SELECT COUNT(*) FROM proofs_used WHERE ${timeCol('created')} < ${effective_end}`;

		const total_promises = parseInt(mintDbQuery(config, promises_sql), 10);
		const total_proofs = parseInt(mintDbQuery(config, proofs_sql), 10);
		return {total_promises, total_proofs, window: {effective_end}};
	},

	/** Differential oracle for `orc-mint-subsection-dashboard-balance-chart`'s
	 *  Balance Sheet *Totals* mode. The chart's per-bucket value is
	 *  `issued − redeemed` per hour, and the cumulative sum across all
	 *  visible buckets equals outstanding ecash supply at the rightmost
	 *  bucket boundary. The Orchard resolver feeds the chart from
	 *  `cashuMintAnalyticsService.getCachedAnalytics` summing the
	 *  `issued_amount` and `redeemed_amount` metrics, both populated by
	 *  backfill from the mint daemon's promise/proof streams
	 *  (mintanalytics.service.ts:419,457).
	 *
	 *  Window. Backfill skips buckets `>= current_hour` and writes
	 *  `last_processed_at` at the most-recent completed hour. Calling code
	 *  derives `last_processed_at` the same way the activity card spec
	 *  does (`max(mint_analytics_recent[i].date)` from the readiness
	 *  probe). The oracle ceilings to `last_processed_at + 3600` so the
	 *  comparison is meaningful when backfill has run end-to-end through
	 *  that hour but live activity may have happened since.
	 *
	 *  Sums. Mirrors `insertPromiseMetrics` / `insertProofMetrics` per-unit
	 *  aggregation:
	 *  - cdk: `blind_signature.amount` for issued (created_time INTEGER,
	 *    epoch seconds on both sqlite and postgres); `proof.amount` for
	 *    redeemed (proofs are inserted only on spend, so all rows count).
	 *  - nutshell: `promises.amount` for issued, `proofs_used.amount` for
	 *    redeemed. `created` is INTEGER on sqlite, TIMESTAMP on postgres —
	 *    extract epoch the same way the other oracles do.
	 *
	 *  Both legs join through the keyset table (`keyset_id` → `keyset.unit`
	 *  for cdk; `id` → `keysets.unit` for nutshell) so the per-unit filter
	 *  matches the chart's per-unit dataset. */
	balanceWindow(
		config: ConfigInfo,
		options: {unit: MintUnit; last_processed_at: number},
	): {issued: number; redeemed: number; balance: number; window: {effective_end: number}} {
		const effective_end = options.last_processed_at + 3600;
		if (effective_end <= 0) return {issued: 0, redeemed: 0, balance: 0, window: {effective_end}};

		const isNutshellPostgres = config.mint === 'nutshell' && config.db === 'postgres';
		const timeCol = (column: string): string => (isNutshellPostgres ? `EXTRACT(EPOCH FROM ${column})` : column);
		const unit = options.unit;

		const issued_sql =
			config.mint === 'cdk'
				? `SELECT COALESCE(SUM(bs.amount), 0) FROM blind_signature bs JOIN keyset k ON k.id = bs.keyset_id WHERE k.unit = '${unit}' AND bs.created_time < ${effective_end}`
				: `SELECT COALESCE(SUM(p.amount), 0) FROM promises p JOIN keysets k ON k.id = p.id WHERE k.unit = '${unit}' AND ${timeCol('p.created')} < ${effective_end}`;
		const redeemed_sql =
			config.mint === 'cdk'
				? `SELECT COALESCE(SUM(p.amount), 0) FROM proof p JOIN keyset k ON k.id = p.keyset_id WHERE k.unit = '${unit}' AND p.created_time < ${effective_end}`
				: `SELECT COALESCE(SUM(p.amount), 0) FROM proofs_used p JOIN keysets k ON k.id = p.id WHERE k.unit = '${unit}' AND ${timeCol('p.created')} < ${effective_end}`;

		const issued = parseInt(mintDbQuery(config, issued_sql), 10);
		const redeemed = parseInt(mintDbQuery(config, redeemed_sql), 10);
		return {issued, redeemed, balance: issued - redeemed, window: {effective_end}};
	},

	/** Differential oracle for the per-metric amount charts on
	 *  `orc-mint-subsection-dashboard`: Mints, Melts, Swaps, Fee Revenue.
	 *  Each chart's per-bucket value is `metric_amount` per unit per hour;
	 *  summing all visible buckets gives the cumulative window total —
	 *  which equals the daemon DB's source-of-truth total over the same
	 *  window. The Orchard resolvers are thin wrappers around
	 *  `getCachedAnalytics([<metric>_amount])` with the per-metric
	 *  bucketing math living in `cashuMintAnalyticsService.insert*Metrics`
	 *  (mintanalytics.service.ts:292,334,376,395). This helper mirrors
	 *  each insertion's source-of-truth aggregation.
	 *
	 *  Window. Same `last_processed_at + 3600` ceiling as `balanceWindow`,
	 *  for the same reason: backfill only writes completed hour buckets
	 *  and surfaces the most-recent one as `last_processed_at`. Reading
	 *  the daemon DB up to that ceiling lets the oracle agree with the
	 *  archive even when live activity has happened since.
	 *
	 *  Per-metric source-of-truth (mirrors backfill's per-row sum):
	 *  - `mints_amount`:
	 *      cdk: `mint_quote.amount_issued WHERE amount_paid > 0 AND amount_paid <= amount_issued`
	 *      (cdk derives ISSUED from these conditions — see cdk.service.ts:179-184).
	 *      nutshell: `mint_quotes.amount WHERE state = 'ISSUED'`.
	 *      Both: created_time INTEGER on cdk + nutshell sqlite; nutshell+postgres
	 *      stores TIMESTAMP and needs `EXTRACT(EPOCH FROM ...)`.
	 *  - `melts_amount`:
	 *      cdk: `melt_quote.amount WHERE state = 'PAID'`.
	 *      nutshell: `melt_quotes.amount WHERE state = 'PAID'`.
	 *  - `swaps_amount`:
	 *      cdk: `completed_operations.total_redeemed WHERE operation_kind = 'swap'` (one row per
	 *      swap; cdk groups by `operation_id`). Time column is `completed_at` (BIGINT epoch).
	 *      nutshell: grouped `proofs_used WHERE melt_quote IS NULL` — one swap == one
	 *      `(pu.created, k.unit)` group, sum of `pu.amount` per group then sum across groups
	 *      (mirrors nutshell.service.ts:478-498).
	 *  - `fees_amount`:
	 *      cdk: `completed_operations.fee_collected WHERE fee_collected > 0`, joined to keyset via
	 *      proof.operation_id (cdk.service.ts:534-544 — fees are input-side in Cashu, so the unit
	 *      comes from the spent proofs' keyset, not the output blind sigs).
	 *      nutshell: derived from `balance_log.keyset_fees_paid` LAG-diffed per unit (the table
	 *      stores cumulative fees-paid per unit per timestamp; the per-op delta is what backfill
	 *      consumes via `listFees`). The window function below mirrors the server's SQL.
	 *
	 *  Per-unit filter applies the same join as backfill so the per-unit
	 *  bucket the chart shows is what the oracle returns. */
	metricWindow(
		config: ConfigInfo,
		options: {metric: 'mints_amount' | 'melts_amount' | 'swaps_amount' | 'fees_amount'; unit: MintUnit; last_processed_at: number},
	): {amount: number; window: {effective_end: number}} {
		const effective_end = options.last_processed_at + 3600;
		if (effective_end <= 0) return {amount: 0, window: {effective_end}};

		const isNutshellPostgres = config.mint === 'nutshell' && config.db === 'postgres';
		const timeCol = (column: string): string => (isNutshellPostgres ? `EXTRACT(EPOCH FROM ${column})` : column);
		const unit = options.unit;

		let sql: string;
		if (options.metric === 'mints_amount') {
			sql =
				config.mint === 'cdk'
					? `SELECT COALESCE(SUM(amount_issued), 0) FROM mint_quote WHERE unit = '${unit}' AND amount_paid > 0 AND amount_paid <= amount_issued AND created_time < ${effective_end}`
					: `SELECT COALESCE(SUM(amount), 0) FROM mint_quotes WHERE unit = '${unit}' AND state = 'ISSUED' AND ${timeCol('created_time')} < ${effective_end}`;
		} else if (options.metric === 'melts_amount') {
			sql =
				config.mint === 'cdk'
					? `SELECT COALESCE(SUM(amount), 0) FROM melt_quote WHERE unit = '${unit}' AND state = 'PAID' AND created_time < ${effective_end}`
					: `SELECT COALESCE(SUM(amount), 0) FROM melt_quotes WHERE unit = '${unit}' AND state = 'PAID' AND ${timeCol('created_time')} < ${effective_end}`;
		} else if (options.metric === 'swaps_amount') {
			sql =
				config.mint === 'cdk'
					? // cdk swap: one row per `operation_id` in `completed_operations` with `operation_kind='swap'`.
					  // Unit comes via the keyset that issued the swap's blind signature(s), joined through
					  // `blind_signature.operation_id`. Multiple blind sigs may share an operation_id (shared
					  // unit per swap), so DISTINCT on operation_id is implicit via the subquery + GROUP BY.
					  `SELECT COALESCE(SUM(co.total_redeemed), 0) FROM completed_operations co LEFT JOIN (SELECT operation_id, MIN(keyset_id) AS keyset_id FROM blind_signature GROUP BY operation_id) bs ON bs.operation_id = co.operation_id LEFT JOIN keyset k ON k.id = bs.keyset_id WHERE co.operation_kind = 'swap' AND k.unit = '${unit}' AND co.completed_at < ${effective_end}`
					: // nutshell swap: rows in `proofs_used WHERE melt_quote IS NULL` are swap inputs;
					  // grouped by `(pu.created, k.unit)` to recover one row per swap. The chart bucket is
					  // SUM(pu.amount) per group, summed across groups.
					  `SELECT COALESCE(SUM(g.amount), 0) FROM (SELECT SUM(pu.amount) AS amount FROM (SELECT * FROM proofs_used WHERE melt_quote IS NULL) pu LEFT JOIN keysets k ON k.id = pu.id WHERE k.unit = '${unit}' AND ${timeCol('pu.created')} < ${effective_end} GROUP BY pu.created, k.unit) g`;
		} else {
			// fees_amount
			sql =
				config.mint === 'cdk'
					? // cdk fee: `completed_operations.fee_collected` per op (>0). Cashu fees are charged on
					  // inputs, so the unit comes from the proofs being spent — not the blind sigs. Mirrors
					  // `listFees` (cdk.service.ts:534-544) which INNER JOINs `proof` then `keyset` and
					  // GROUP BYs (operation_id, completed_at, fee_collected, unit) to dedupe the row
					  // multiplication from N proofs per op. Mint ops are excluded by the `fee_collected > 0`
					  // filter (mints don't charge fees); swap and melt ops both have proof rows, so the
					  // inner join keeps every fee-bearing op without a NULL-unit fallback.
					  `SELECT COALESCE(SUM(fee), 0) FROM (SELECT co.operation_id, co.fee_collected AS fee, k.unit FROM (SELECT * FROM completed_operations WHERE fee_collected > 0) co INNER JOIN proof p ON p.operation_id = co.operation_id INNER JOIN keyset k ON k.id = p.keyset_id WHERE k.unit = '${unit}' AND co.completed_at < ${effective_end} GROUP BY co.operation_id, co.fee_collected, k.unit) deduped`
					: // nutshell fee: `balance_log.keyset_fees_paid` is cumulative per unit; LAG-diff to recover
					  // per-event deltas, filter positive, sum within the window. Mirrors nutshell.service.ts:565-575.
					  `SELECT COALESCE(SUM(fee), 0) FROM (SELECT unit, time AS created_time, keyset_fees_paid - LAG(keyset_fees_paid, 1, 0) OVER (PARTITION BY unit ORDER BY time) AS fee FROM balance_log) deltas WHERE unit = '${unit}' AND fee > 0 AND ${timeCol('created_time')} < ${effective_end}`;
		}

		const amount = parseInt(mintDbQuery(config, sql), 10);
		return {amount, window: {effective_end}};
	},

	/** Differential oracle for `orc-mint-subsection-dashboard-ecash-chart`'s
	 *  per-unit Blind Signatures + Proofs counts. Same `last_processed_at + 3600`
	 *  ceiling as the other window oracles. Per-unit because the Ecash chart
	 *  groups its stacked-bar datasets by unit — the existing
	 *  `keysetCountsOracle` returns a single global total which collapses
	 *  multi-unit stacks into one number.
	 *
	 *  cdk: `blind_signature` (promises) + `proof` (proofs) joined through
	 *  the keyset table for unit. Like `keysetCountsOracle`, no state
	 *  filter on `proof` — backfill streams `states: [SPENT]` but cdk
	 *  regtest only emits SPENT proofs, so the unfiltered count agrees.
	 *  nutshell: `promises` + `proofs_used`, joined through `keysets`. */
	countsWindow(
		config: ConfigInfo,
		options: {unit: MintUnit; last_processed_at: number},
	): {promises: number; proofs: number; window: {effective_end: number}} {
		const effective_end = options.last_processed_at + 3600;
		if (effective_end <= 0) return {promises: 0, proofs: 0, window: {effective_end}};

		const isNutshellPostgres = config.mint === 'nutshell' && config.db === 'postgres';
		const timeCol = (column: string): string => (isNutshellPostgres ? `EXTRACT(EPOCH FROM ${column})` : column);
		const unit = options.unit;

		const promises_sql =
			config.mint === 'cdk'
				? `SELECT COUNT(*) FROM blind_signature bs JOIN keyset k ON k.id = bs.keyset_id WHERE k.unit = '${unit}' AND bs.created_time < ${effective_end}`
				: `SELECT COUNT(*) FROM promises p JOIN keysets k ON k.id = p.id WHERE k.unit = '${unit}' AND ${timeCol('p.created')} < ${effective_end}`;
		const proofs_sql =
			config.mint === 'cdk'
				? `SELECT COUNT(*) FROM proof p JOIN keyset k ON k.id = p.keyset_id WHERE k.unit = '${unit}' AND p.created_time < ${effective_end}`
				: `SELECT COUNT(*) FROM proofs_used p JOIN keysets k ON k.id = p.id WHERE k.unit = '${unit}' AND ${timeCol('p.created')} < ${effective_end}`;

		const promises = parseInt(mintDbQuery(config, promises_sql), 10);
		const proofs = parseInt(mintDbQuery(config, proofs_sql), 10);
		return {promises, proofs, window: {effective_end}};
	},

	/** Differential oracle for `orc-mint-general-activity`. Mirrors the
	 *  server's `mint_activity_summary` math (mintactivity.service.ts), but
	 *  reads the mint daemon's DB directly instead of the
	 *  `mint_analytics_cache` Orchard archives into.
	 *
	 *  Window. The server's cache query is `Between(start_hour, end_hour)`
	 *  with `start_hour = startOfHour(now - period)` (UTC) and
	 *  `end_hour = startOfHour(now) - 3600`. So a row's hour bucket is in
	 *  the cache iff `start_hour <= created_time < startOfHour(now)`.
	 *
	 *  Ceiling. Backfill writes the cache in `created_time ASC` order and
	 *  stores `last_processed_at` at the hour bucket of the most-recent
	 *  record. Hour buckets `> last_processed_at` may have rows in the
	 *  daemon DB that haven't been written to the cache yet (the next
	 *  `:05` hourly cron run is what catches them up — there is no
	 *  on-demand backfill GraphQL endpoint). To make the oracle ↔ UI
	 *  comparison meaningful, the oracle ceilings its upper bound to
	 *  `last_processed_at + 3600`. Tests for activity-card correctness are
	 *  therefore validating that the cache representation matches the
	 *  daemon DB *up through the cache's own coverage window* — they are
	 *  NOT validating real-time freshness. Fetch `last_processed_at` from
	 *  the `mint_analytics_backfill_status` query (or from `getReadiness`)
	 *  and pass it in.
	 *
	 *  Counts mirror the server's metric definitions exactly:
	 *  - `mint_count` = COUNT(*) of mint quotes (all states), per
	 *    `mints_created` (mintanalytics.service.ts:283-296)
	 *  - `melt_count` = COUNT(*) of melt quotes (all states), per
	 *    `melts_created` (line 325-338)
	 *  - `swap_count` = number of grouped swap operations, per
	 *    `swaps_amount` (line 367-381). Grouping differs by backend:
	 *    nutshell groups `proofs_used WHERE melt_quote IS NULL` by
	 *    `(created_time, unit)`; cdk groups `completed_operations` by
	 *    `operation_id` where `operation_kind='swap'`.
	 *  - `total_volume` = sum of issued mint amount + paid melt amount +
	 *    swap amount.
	 *  - `*_completed_pct` = (issued|paid count) / (total count) * 100. */
	activitySummaryOracle(
		config: ConfigInfo,
		options: {last_processed_at: number; period_seconds?: number},
	): {
		mint_count: number;
		melt_count: number;
		swap_count: number;
		total_operations: number;
		total_volume: number;
		mint_completed_pct: number;
		melt_completed_pct: number;
		window: {start_hour: number; effective_end: number};
	} {
		const period_seconds = options.period_seconds ?? 86_400;
		const now = Math.floor(Date.now() / 1000);
		const start_of_current_hour = now - (now % 3600);
		const start_hour = start_of_current_hour - period_seconds;
		const cache_ceiling = options.last_processed_at + 3600;
		const effective_end = Math.min(start_of_current_hour, cache_ceiling);

		const empty = {
			mint_count: 0,
			melt_count: 0,
			swap_count: 0,
			total_operations: 0,
			total_volume: 0,
			mint_completed_pct: 0,
			melt_completed_pct: 0,
			window: {start_hour, effective_end},
		};
		if (effective_end <= start_hour) return empty;

		// Time encoding varies across stacks:
		//   cdk + sqlite/postgres : created_time/paid_time INTEGER, completed_at BIGINT
		//                           — both epoch seconds, comparable directly
		//   nutshell + sqlite     : created_time INTEGER (epoch seconds), comparable
		//                           directly
		//   nutshell + postgres   : created_time TIMESTAMP WITHOUT TIME ZONE — must
		//                           extract epoch seconds via EXTRACT(EPOCH FROM ...)
		//                           before numeric comparison; bare comparison errors
		//                           with `cannot cast type timestamp ... to integer`.
		// `timeCol` returns the right SQL expression for the given column on this
		// stack, with no casts on integer columns (avoids a needless CAST AS REAL
		// that would otherwise fail on a postgres timestamp column).
		const isNutshellPostgres = config.mint === 'nutshell' && config.db === 'postgres';
		const timeCol = (column: string): string => (isNutshellPostgres ? `EXTRACT(EPOCH FROM ${column})` : column);
		const time_lo = start_hour;
		const time_hi = effective_end;

		let mint_count: number;
		let mint_issued_count: number;
		let mint_amount_issued: number;
		let melt_count: number;
		let melt_paid_count: number;
		let melt_amount_paid: number;
		let swap_count: number;
		let swap_amount: number;

		if (config.mint === 'nutshell') {
			// nutshell stores `state` as a TEXT column directly. ISSUED is the
			// terminal state for paid+redeemed mint quotes; `amount_issued` in
			// nutshell maps to the row's own `amount` column.
			const mint_sql = `SELECT COUNT(*), COUNT(CASE WHEN state='ISSUED' THEN 1 END), COALESCE(SUM(CASE WHEN state='ISSUED' THEN amount ELSE 0 END), 0) FROM mint_quotes WHERE ${timeCol('created_time')} >= ${time_lo} AND ${timeCol('created_time')} < ${time_hi}`;
			const melt_sql = `SELECT COUNT(*), COUNT(CASE WHEN state='PAID' THEN 1 END), COALESCE(SUM(CASE WHEN state='PAID' THEN amount ELSE 0 END), 0) FROM melt_quotes WHERE ${timeCol('created_time')} >= ${time_lo} AND ${timeCol('created_time')} < ${time_hi}`;
			// Swap grouping mirrors nutshell.service.ts:478-498 — one swap =
			// one `(pu.created, k.unit)` group in `proofs_used WHERE melt_quote IS NULL`.
			const swap_sql = `SELECT COUNT(*), COALESCE(SUM(amount), 0) FROM (SELECT SUM(pu.amount) AS amount FROM (SELECT * FROM proofs_used WHERE melt_quote IS NULL) pu LEFT JOIN keysets k ON k.id = pu.id WHERE ${timeCol('pu.created')} >= ${time_lo} AND ${timeCol('pu.created')} < ${time_hi} GROUP BY pu.created, k.unit) g`;

			[mint_count, mint_issued_count, mint_amount_issued] = mintDbQuery(config, mint_sql).split('|').map(Number);
			[melt_count, melt_paid_count, melt_amount_paid] = mintDbQuery(config, melt_sql).split('|').map(Number);
			[swap_count, swap_amount] = mintDbQuery(config, swap_sql).split('|').map(Number);
		} else {
			// cdk derives state from `(amount_paid, amount_issued)` rather than
			// storing a string — see cdk.service.ts:179-184. ISSUED ⇔
			// `amount_paid > 0 AND amount_paid <= amount_issued`. Melt has a
			// real `state` column. Swaps live in `completed_operations` keyed
			// on `operation_id` with `operation_kind='swap'`
			// (cdk.service.ts:525-557); `total_redeemed` is the swap amount.
			// cdk stores all three time columns as INTEGER/BIGINT epoch seconds
			// in both sqlite and postgres, so direct numeric comparison is fine.
			const mint_sql = `SELECT COUNT(*), COUNT(CASE WHEN amount_paid > 0 AND amount_paid <= amount_issued THEN 1 END), COALESCE(SUM(CASE WHEN amount_paid > 0 AND amount_paid <= amount_issued THEN amount_issued ELSE 0 END), 0) FROM mint_quote WHERE created_time >= ${time_lo} AND created_time < ${time_hi}`;
			const melt_sql = `SELECT COUNT(*), COUNT(CASE WHEN state='PAID' THEN 1 END), COALESCE(SUM(CASE WHEN state='PAID' THEN amount ELSE 0 END), 0) FROM melt_quote WHERE created_time >= ${time_lo} AND created_time < ${time_hi}`;
			const swap_sql = `SELECT COUNT(DISTINCT operation_id), COALESCE(SUM(total_redeemed), 0) FROM completed_operations WHERE operation_kind = 'swap' AND completed_at >= ${time_lo} AND completed_at < ${time_hi}`;

			[mint_count, mint_issued_count, mint_amount_issued] = mintDbQuery(config, mint_sql).split('|').map(Number);
			[melt_count, melt_paid_count, melt_amount_paid] = mintDbQuery(config, melt_sql).split('|').map(Number);
			[swap_count, swap_amount] = mintDbQuery(config, swap_sql).split('|').map(Number);
		}

		const total_operations = mint_count + melt_count + swap_count;
		const total_volume = mint_amount_issued + melt_amount_paid + swap_amount;
		const mint_completed_pct = mint_count > 0 ? (mint_issued_count / mint_count) * 100 : 0;
		const melt_completed_pct = melt_count > 0 ? (melt_paid_count / melt_count) * 100 : 0;

		return {
			mint_count,
			melt_count,
			swap_count,
			total_operations,
			total_volume,
			mint_completed_pct,
			melt_completed_pct,
			window: {start_hour, effective_end},
		};
	},
};
