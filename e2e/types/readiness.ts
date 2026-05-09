/**
 * Backend-state types consumed by `helpers/ui/readiness.ts` and any spec/setup
 * that builds a custom predicate. Type-only file — no runtime exports.
 */

export interface BlockchainInfo {
	verificationprogress: number;
	initialblockdownload: boolean;
	blocks: number;
}

export interface OraclePrice {
	date: number;
	price: number;
}

/** A single hour-bucket row from one of the analytics caches
 *  (`analytics_mint` / `analytics_lightning` / `analytics_bitcoin`). The
 *  shape matches what the corresponding `*_analytics_metrics` queries
 *  return — only `date` is required for readiness gating; downstream
 *  oracle helpers may read further fields when they make their own
 *  query. `date` is a UTC-aligned hour boundary (epoch seconds) — the
 *  bucket the backfill writes into. */
export interface AnalyticsCacheRow {
	date: number;
}

export interface Readiness {
	bitcoin: BlockchainInfo;
	oracle_recent: OraclePrice[];
	/** Probe of `mint_analytics_metrics(metrics: [mints_created, melts_created, swaps_amount])`
	 *  over the full historical range. `length > 0` means the cashu mint
	 *  analytics backfill has populated `analytics_mint` for at least one
	 *  hour bucket — i.e. the activity card has data to render. Persisted
	 *  state (unlike `mint_analytics_backfill_status`, whose
	 *  `last_processed_at` is in-memory and resets on orchard restart). */
	mint_analytics_recent: AnalyticsCacheRow[];
	/** Probe of `lightning_analytics_local_balance` over the full historical
	 *  range. Empty on stacks where Orchard runs without a Lightning backend
	 *  (`fake-cdk-postgres`); for any stack with `LIGHTNING_TYPE` set, empty
	 *  means the LN backfill hasn't produced rows yet. */
	lightning_analytics_recent: AnalyticsCacheRow[];
	/** Probe of `bitcoin_analytics_metrics` over the full historical range.
	 *  Empty when bitcoin is disabled (`fake-cdk-postgres`) or when the
	 *  bitcoin analytics backfill hasn't yet produced wallet/asset rows
	 *  (specs that read on-chain analytics should gate on this). */
	bitcoin_analytics_recent: AnalyticsCacheRow[];
	/** `ai_health.status` from the AI health resolver. False on non-AI stacks
	 *  (resolver errors → probe falls back to false) or when the configured
	 *  vendor (Ollama/OpenRouter) is unreachable. Gate `@ai` specs on this. */
	ai_health: boolean;
}

export interface ReadinessPredicate {
	(r: Readiness): {ok: boolean; reason: string};
}
