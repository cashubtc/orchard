/**
 * Backend-state readiness check, composed from the same GraphQL queries the
 * client UI already uses. No bespoke server endpoint — `bitcoin_blockchain_info`
 * tells us if the chain is synced; `bitcoin_oracle` tells us if a price exists
 * for a given day; the `*_analytics_metrics` queries tell us whether each
 * analytics cache has been populated. Both setup phases and specs use these
 * to skip cleanly when a precondition isn't met (e.g. mainchain still in IBD,
 * oracle not yet backfilled, mint analytics empty), surfacing a structured
 * `e2e-readiness:` skip reason rather than failing or hanging.
 */

import {type Page, test} from '@playwright/test';
import {gql} from '@e2e/helpers/ui/gql';
import type {AnalyticsCacheRow, BlockchainInfo, MetricSampleRow, OraclePrice, Readiness, ReadinessPredicate} from '@e2e/types/readiness';

const BITCOIN_BLOCKCHAIN_INFO_QUERY = `{ bitcoin_blockchain_info { verificationprogress initialblockdownload blocks } }`;
const BITCOIN_ORACLE_RECENT_QUERY = `query Recent($start_date: UnixTimestamp, $end_date: UnixTimestamp) {
	bitcoin_oracle(start_date: $start_date, end_date: $end_date) { date price }
}`;
/** Probe `analytics_mint` for any row across the metrics that drive the
 *  activity card. The resolver filters `amount !== '0'` (mintanalytics.service.ts:119),
 *  so probes must use the *_amount metrics — those carry the operation
 *  totals for ISSUED mints, PAID melts, and grouped swaps respectively
 *  (the *_created metrics carry `count` only with `amount=0`, which the
 *  filter strips). `interval: hour` preserves raw hour buckets so
 *  consumers can derive the cache's coverage ceiling from `max(date)`. */
const MINT_ANALYTICS_PROBE_QUERY = `{
	mint_analytics_metrics(metrics: [mints_amount, melts_amount, swaps_amount], interval: hour) {
		date
	}
}`;
/** Probe `analytics_lightning`. Same `amount !== '0'` filter
 *  (lnanalytics.service.ts:62) — restrict to metrics with non-zero
 *  amounts on a stack with traffic. */
const LIGHTNING_ANALYTICS_PROBE_QUERY = `{
	lightning_analytics_metrics(metrics: [payments_out, invoices_in], interval: hour) {
		date
	}
}`;
/** Probe `analytics_bitcoin`. Same `amount !== '0'` filter
 *  (btcanalytics.service.ts:40). */
const BITCOIN_ANALYTICS_PROBE_QUERY = `{
	bitcoin_analytics_metrics(metrics: [payments_in, payments_out], interval: hour) {
		date
	}
}`;
const AI_HEALTH_QUERY = `{ ai_health { status } }`;
/** Probe a single `metrics_system` family over a short recent window — the host-metrics cron
 *  (gated on the `system.metrics` setting, default true) has collected at
 *  least once recently. Host families are stored gauge-style, so one row is enough
 *  for every chart on `/system`. */
const SYSTEM_METRICS_PROBE_QUERY = `query RecentSystemMetrics($date_start: UnixTimestamp, $date_end: UnixTimestamp) {
	system_metrics(date_start: $date_start, date_end: $date_end, interval: minute, metrics: [cpu_percent]) { date }
}`;
/** Probe `metrics_mint` over a short recent window via a gauge family the cdk exporter always serves —
 *  one stored scrape is enough for gauges (counters need two). Empty when
 *  `MINT_METRICS_API` is unset or the mint isn't cdk (the resolver throws
 *  MintSupportError, which `probe` collapses to `[]`). */
const MINT_METRICS_PROBE_QUERY = `query RecentMintMetrics($date_start: UnixTimestamp, $date_end: UnixTimestamp) {
	mint_metrics(date_start: $date_start, date_end: $date_end, interval: minute, metrics: ["process_memory_bytes"]) { date }
}`;

const SECONDS_PER_DAY = 86_400;
const METRICS_PROBE_WINDOW_SECONDS = 10 * 60;

/** Run a probe query and collapse any backend-side error into a safe
 *  default. The readiness probes fire across all stacks even when a
 *  feature is disabled (e.g. `bitcoin_analytics_metrics` on
 *  `fake-cdk-postgres` errors with `BitcoinRPCError`, `mint_metrics` on
 *  non-cdk stacks with `MintSupportError`); treating the
 *  error as "no rows" is correct for presence-only predicates because a
 *  disabled backend has no analytics rows anyway, and lets a single
 *  `getReadiness` call serve every stack without per-stack branching.
 *  Throwing-style errors (auth, transport) still propagate via the
 *  inner `gql()` if the request itself fails — only resolver-level
 *  GraphQL errors are caught here. */
async function probe<T>(page: Page, query: string, field: string, fallback: T, variables?: Record<string, unknown>): Promise<T> {
	try {
		const data = await gql(page, query, variables);
		return (data[field] as T) ?? fallback;
	} catch {
		return fallback;
	}
}

/** Compose backend-state queries the UI already uses. Cheap enough to call
 *  per-test; promote to a worker-scoped fixture if it ever shows up in a
 *  trace. */
export async function getReadiness(page: Page): Promise<Readiness> {
	const now_unix = Math.floor(Date.now() / 1000);
	const start = now_unix - 7 * SECONDS_PER_DAY;
	const metrics_start = now_unix - METRICS_PROBE_WINDOW_SECONDS;
	const recent_variables = {date_start: start, date_end: now_unix};
	const metrics_variables = {date_start: metrics_start, date_end: now_unix};
	const [bitcoin_data, oracle_data, mint_probe, ln_probe, btc_probe, ai_health_data, system_metrics_probe, mint_metrics_probe] =
		await Promise.all([
			// Bitcoin chain-info errors on no-bitcoin stacks (`fake-cdk-postgres`),
			// so wrap in `probe` and fall back to a safe default; the
			// `mainchainSynced` predicate is only used on bitcoin-enabled stacks
			// where the call succeeds.
			probe<BlockchainInfo>(page, BITCOIN_BLOCKCHAIN_INFO_QUERY, 'bitcoin_blockchain_info', {
				verificationprogress: 0,
				initialblockdownload: true,
				blocks: 0,
			}),
			probe<OraclePrice[]>(page, BITCOIN_ORACLE_RECENT_QUERY, 'bitcoin_oracle', [], recent_variables),
			probe<AnalyticsCacheRow[]>(page, MINT_ANALYTICS_PROBE_QUERY, 'mint_analytics_metrics', []),
			probe<AnalyticsCacheRow[]>(page, LIGHTNING_ANALYTICS_PROBE_QUERY, 'lightning_analytics_metrics', []),
			probe<AnalyticsCacheRow[]>(page, BITCOIN_ANALYTICS_PROBE_QUERY, 'bitcoin_analytics_metrics', []),
			probe<{status: boolean}>(page, AI_HEALTH_QUERY, 'ai_health', {status: false}),
			probe<MetricSampleRow[]>(page, SYSTEM_METRICS_PROBE_QUERY, 'system_metrics', [], metrics_variables),
			probe<MetricSampleRow[]>(page, MINT_METRICS_PROBE_QUERY, 'mint_metrics', [], metrics_variables),
		]);
	return {
		bitcoin: bitcoin_data,
		oracle_recent: oracle_data,
		mint_analytics_recent: mint_probe,
		lightning_analytics_recent: ln_probe,
		bitcoin_analytics_recent: btc_probe,
		ai_health: ai_health_data.status,
		system_metrics_recent: system_metrics_probe,
		mint_metrics_recent: mint_metrics_probe,
	};
}

/** Skip the current test (or setup step) if the predicate fails. The reason
 *  is prefixed `e2e-readiness:` so reporters can group readiness skips
 *  separately from grep-not-applicable ones.
 *
 *  Call AFTER `page.goto(...)` — `localStorage` access on `about:blank`
 *  raises `SecurityError`, so the page must be on an Orchard origin first. */
export async function requireReady(page: Page, predicate: ReadinessPredicate): Promise<void> {
	const readiness = await getReadiness(page);
	const {ok, reason} = predicate(readiness);
	test.skip(!ok, `e2e-readiness: ${reason}`);
}

/** Tip is fresh enough to run oracle backfill — chain not in IBD and headers
 *  caught up. The verificationprogress threshold matches the UI's "Bitcoin
 *  Disabled" gating. */
export const mainchainSynced: ReadinessPredicate = (r) => ({
	ok: !r.bitcoin.initialblockdownload && r.bitcoin.verificationprogress >= 0.99,
	reason: `mainchain_synced ibd=${r.bitcoin.initialblockdownload} progress=${r.bitcoin.verificationprogress.toFixed(4)}`,
});

/** Oracle has at least one recent price (within the last 7 days). Used by
 *  specs that depend on `oracle.setup.ts` having staged data. */
export const oracleHasRecentData: ReadinessPredicate = (r) => ({
	ok: r.oracle_recent.length > 0,
	reason: `oracle_has_recent_data rows=${r.oracle_recent.length}`,
});

/** `analytics_mint` has at least one row — the cashu mint analytics
 *  backfill has run AND found mint/melt/swap operations to bucket. This
 *  is the ground truth for "the activity card has data to render": the
 *  table is persisted to `orchard.db`, so unlike the in-memory
 *  `mint_analytics_backfill_status.last_processed_at` it survives
 *  orchard restarts. Specs that need a cache-window ceiling for
 *  cache↔DB differential assertions should derive it from
 *  `max(r.mint_analytics_recent[i].date) + 3600` rather than
 *  `last_processed_at`. */
export const mintAnalyticsHasRows: ReadinessPredicate = (r) => ({
	ok: r.mint_analytics_recent.length > 0,
	reason: `mint_analytics_has_rows rows=${r.mint_analytics_recent.length}`,
});

/** `analytics_lightning` has at least one row — the LN analytics
 *  backfill has run AND found payments/invoices to bucket. Empty on
 *  no-LN stacks (`fake-cdk-postgres`); on LN-enabled stacks this is the
 *  gate for any spec that asserts on the LN side of the activity /
 *  balance / channel charts. */
export const lightningAnalyticsHasRows: ReadinessPredicate = (r) => ({
	ok: r.lightning_analytics_recent.length > 0,
	reason: `lightning_analytics_has_rows rows=${r.lightning_analytics_recent.length}`,
});

/** AI vendor (Ollama or OpenRouter) is reachable and the model responds.
 *  False on non-AI stacks and when the configured vendor is unreachable.
 *  Gate all `@ai` specs on this to skip cleanly rather than hanging. */
export const aiIsHealthy: ReadinessPredicate = (r) => ({
	ok: r.ai_health,
	reason: `ai_healthy=${r.ai_health}`,
});

/** `analytics_bitcoin` has at least one row — the on-chain analytics
 *  backfill has run AND found wallet transactions to bucket. Empty on
 *  no-bitcoin stacks; on bitcoin-enabled stacks this is the gate for
 *  any spec that asserts on bitcoin chain analytics surfaces. */
export const bitcoinAnalyticsHasRows: ReadinessPredicate = (r) => ({
	ok: r.bitcoin_analytics_recent.length > 0,
	reason: `bitcoin_analytics_has_rows rows=${r.bitcoin_analytics_recent.length}`,
});

/** `metrics_system` has at least one recent row — the per-minute host-metrics cron
 *  (gated on `system.metrics`, default true) has collected. Gate for any
 *  spec asserting populated charts on `/system`. */
export const systemMetricsHasRows: ReadinessPredicate = (r) => ({
	ok: r.system_metrics_recent.length > 0,
	reason: `system_metrics_has_rows rows=${r.system_metrics_recent.length}`,
});

/** `metrics_mint` has at least one recent row — `MINT_METRICS_API` is set AND the
 *  per-minute scrape cron has stored a sample from the cdk exporter. Gauges
 *  chart from one sample; counters need two. */
export const mintMetricsHasRows: ReadinessPredicate = (r) => ({
	ok: r.mint_metrics_recent.length > 0,
	reason: `mint_metrics_has_rows rows=${r.mint_metrics_recent.length}`,
});
