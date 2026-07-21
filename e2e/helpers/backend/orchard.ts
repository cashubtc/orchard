/**
 * Orchard server's own database reads. Distinct from the mint daemon's DB
 * — Orchard persists settings, oracle backfills, analytics checkpoints, and
 * users in `/app/data/orchard.db` (sqlite, WAL mode).
 */

/* Native Dependencies */
import {orchardDbQuery, parseSqlBoolean} from './_sql';
import type {ConfigInfo} from '@e2e/types/config';

/** Single-quote-escape a value for inline SQL — same approach `eventCount`
 *  uses for its status list. Every caller below interpolates only test-
 *  authored probe strings (agent/invite/user names), never operator input,
 *  but escaping keeps a literal with an apostrophe from breaking the query. */
function sqlEscape(value: string): string {
	return value.replace(/'/g, "''");
}

/** Split one pipe-separated `-noheader -separator |` row into cells.
 *  `orchardDbQuery` returns `''` for an empty result set — callers guard
 *  that before calling this. */
function cells(row: string): string[] {
	return row.split('|');
}

/** `''` → null, else the raw string. sqlite emits empty text for NULL
 *  columns under `-noheader`. */
function nullable(value: string | undefined): string | null {
	return value === undefined || value === '' ? null : value;
}

/** `''` → null, else parseInt. For nullable INTEGER columns. */
function intOrNull(value: string | undefined): number | null {
	const s = nullable(value);
	return s === null ? null : parseInt(s, 10);
}

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
	eventCount(
		config: ConfigInfo,
		opts: {date_start?: number; date_end?: number; statuses?: string[]; sections?: string[]; types?: string[]} = {},
	): number {
		const where: string[] = [];
		if (opts.date_start !== undefined) where.push(`timestamp >= ${Math.floor(opts.date_start)}`);
		if (opts.date_end !== undefined) where.push(`timestamp <= ${Math.floor(opts.date_end)}`);
		// The `section` / `status` / `type` columns store the enum value
		// LOWERCASE (`mint`, `success`, `update`), but callers pass the wire
		// enum names UPPERCASE (`MINT`, `SUCCESS`) — compare case-insensitively
		// so the filter actually matches instead of silently counting 0.
		const inClause = (column: string, values: string[]) =>
			`LOWER(${column}) IN (${values.map((v) => `'${sqlEscape(v.toLowerCase())}'`).join(', ')})`;
		if (opts.statuses && opts.statuses.length > 0) where.push(inClause('status', opts.statuses));
		if (opts.sections && opts.sections.length > 0) where.push(inClause('section', opts.sections));
		if (opts.types && opts.types.length > 0) where.push(inClause('type', opts.types));
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

	/** Earliest hour bucket in the mint analytics archive (`analytics_mint`),
	 *  unix seconds, or null when the archive is empty. Cache↔DB differentials
	 *  are only meaningful when this floor covers the mint's earliest activity
	 *  — a floor ABOVE it means the archive has a hole (seen after the 1.10
	 *  boot wiped `analytics_mint` while `analytics_checkpoint` survived,
	 *  chip task_32c3e61d) and both sides can never agree. NOT cached. */
	mintArchiveFloor(config: ConfigInfo): number | null {
		const out = orchardDbQuery(config, 'SELECT MIN(date) FROM analytics_mint');
		if (out === '') return null;
		return parseInt(out, 10);
	},

	/* *******************************************************
		Metrics — the `metrics_system` + `metrics_mint`
		minute-bucket tables written by the per-minute
		collection crons.
	******************************************************** */

	/** Row count of `metrics_system` (host metrics, gated on the
	 *  `system.metrics` setting). NOT cached: rows accrue every minute. */
	metricsSystemCount(config: ConfigInfo): number {
		return parseInt(orchardDbQuery(config, 'SELECT COUNT(*) FROM metrics_system'), 10);
	},

	/** Row count of `metrics_mint` (cdk prometheus scrapes, gated on the
	 *  `MINT_METRICS_API` env config). NOT cached: rows accrue every minute. */
	metricsMintCount(config: ConfigInfo): number {
		return parseInt(orchardDbQuery(config, 'SELECT COUNT(*) FROM metrics_mint'), 10);
	},

	/* *******************************************************
		Settings — the `settings` key/value table.
	******************************************************** */

	/** Value of one `settings` row by key (e.g. `ai.enabled`, `ai.vendor`,
	 *  `ai.ollama.api`, `bitcoin.oracle`). Stored raw (not JSON-quoted) for
	 *  STRING/BOOL settings — `SettingService.getStringSetting` reads this
	 *  same row, so compare verbatim. Null when the key is unset. Key is a
	 *  fixed literal, never user input. NOT cached: settings mutate mid-run. */
	setting(config: ConfigInfo, key: string): string | null {
		const out = orchardDbQuery(config, `SELECT value FROM settings WHERE key = '${sqlEscape(key)}'`);
		return out === '' ? null : out;
	},

	/* *******************************************************
		AI agents — the `agents` + `agent_runs` tables (custom
		agents have `agent_key IS NULL`; built-ins carry a key).
	******************************************************** */

	/** One custom agent by name, or null. Names are unique per operator, so
	 *  the e2e probe-agent name isolates cleanly. `active` via parseSqlBoolean
	 *  (sqlite 0/1); `tools`/`schedules` are raw JSON strings; `agent_key` is
	 *  null for custom agents. NOT cached (CRUD mutates mid-test). */
	agentByName(
		config: ConfigInfo,
		name: string,
	): {
		id: string;
		name: string;
		description: string | null;
		model: string | null;
		active: boolean;
		tools: string | null;
		schedules: string | null;
		agent_key: string | null;
		updated_at: number | null;
	} | null {
		const sql = `SELECT id, name, description, model, active, tools, schedules, agent_key, updated_at FROM agents WHERE name = '${sqlEscape(name)}'`;
		const out = orchardDbQuery(config, sql);
		if (out === '') return null;
		const [id, agent_name, description, model, active, tools, schedules, agent_key, updated_at] = cells(out);
		return {
			id,
			name: agent_name,
			description: nullable(description),
			model: nullable(model),
			active: parseSqlBoolean(active),
			tools: nullable(tools),
			schedules: nullable(schedules),
			agent_key: nullable(agent_key),
			updated_at: intOrNull(updated_at),
		};
	},

	/** Count of agents with a given name — 0 after a delete, 1 after create. */
	agentCountByName(config: ConfigInfo, name: string): number {
		return parseInt(orchardDbQuery(config, `SELECT COUNT(*) FROM agents WHERE name = '${sqlEscape(name)}'`), 10);
	},

	/** Agent id by name, or null. Handy to capture the id for `agent_runs`
	 *  lookups without re-reading the whole row. */
	agentIdByName(config: ConfigInfo, name: string): string | null {
		const out = orchardDbQuery(config, `SELECT id FROM agents WHERE name = '${sqlEscape(name)}'`);
		return out === '' ? null : out;
	},

	/** Full agent row by id (validates the CREATE differential + that a
	 *  custom job has `agent_key IS NULL`). */
	agentRow(
		config: ConfigInfo,
		id: string,
	): {name: string; active: boolean; model: string | null; schedules: string | null; agent_key: string | null} | null {
		const out = orchardDbQuery(config, `SELECT name, active, model, schedules, agent_key FROM agents WHERE id = '${sqlEscape(id)}'`);
		if (out === '') return null;
		const [name, active, model, schedules, agent_key] = cells(out);
		return {
			name,
			active: parseSqlBoolean(active),
			model: nullable(model),
			schedules: nullable(schedules),
			agent_key: nullable(agent_key),
		};
	},

	/** Number of `agent_runs` rows for an agent — the before/after delta is
	 *  the EXECUTE differential. FK column is `agent_id`. */
	agentRunCount(config: ConfigInfo, agent_id: string): number {
		return parseInt(orchardDbQuery(config, `SELECT COUNT(*) FROM agent_runs WHERE agent_id = '${sqlEscape(agent_id)}'`), 10);
	},

	/** Newest `agent_runs` row for an agent (assert status resolved, not
	 *  stuck 'running'). Null when the agent has never run. */
	latestAgentRun(config: ConfigInfo, agent_id: string): {status: string; started_at: number | null; completed_at: number | null} | null {
		const sql = `SELECT status, started_at, completed_at FROM agent_runs WHERE agent_id = '${sqlEscape(agent_id)}' ORDER BY started_at DESC LIMIT 1`;
		const out = orchardDbQuery(config, sql);
		if (out === '') return null;
		const [status, started_at, completed_at] = cells(out);
		return {status, started_at: intOrNull(started_at), completed_at: intOrNull(completed_at)};
	},

	/* *******************************************************
		Crew — the `invites` + `users` tables.
	******************************************************** */

	/** All crew invites, newest first. `label`/`expires_at`/`used_at` may be
	 *  null. NOT cached (invites churn mid-run). */
	crewInvites(config: ConfigInfo): Array<{
		id: string;
		token: string;
		label: string | null;
		role: string;
		expires_at: number | null;
		used_at: number | null;
		created_at: number;
	}> {
		const out = orchardDbQuery(
			config,
			'SELECT id, token, label, role, expires_at, used_at, created_at FROM invites ORDER BY created_at DESC',
		);
		if (out === '') return [];
		return out.split('\n').map((row) => {
			const [id, token, label, role, expires_at, used_at, created_at] = cells(row);
			return {
				id,
				token,
				label: nullable(label),
				role,
				expires_at: intOrNull(expires_at),
				used_at: intOrNull(used_at),
				created_at: parseInt(created_at, 10),
			};
		});
	},

	/** First unclaimed invite with a given label, or null. Keyed on the
	 *  unique probe label a create-test assigns. */
	crewInviteByLabel(
		config: ConfigInfo,
		label: string,
	): {id: string; token: string; label: string | null; role: string; expires_at: number | null; used_at: number | null} | null {
		const sql = `SELECT id, token, label, role, expires_at, used_at FROM invites WHERE label = '${sqlEscape(label)}' AND used_at IS NULL LIMIT 1`;
		const out = orchardDbQuery(config, sql);
		if (out === '') return null;
		const [id, token, l, role, expires_at, used_at] = cells(out);
		return {id, token, label: nullable(l), role, expires_at: intOrNull(expires_at), used_at: intOrNull(used_at)};
	},

	/** One invite by immutable id (the UPDATE/DELETE oracle). Null when gone. */
	crewInviteById(
		config: ConfigInfo,
		id: string,
	): {id: string; token: string; label: string | null; role: string; expires_at: number | null; used_at: number | null} | null {
		const sql = `SELECT id, token, label, role, expires_at, used_at FROM invites WHERE id = '${sqlEscape(id)}'`;
		const out = orchardDbQuery(config, sql);
		if (out === '') return null;
		const [invite_id, token, label, role, expires_at, used_at] = cells(out);
		return {id: invite_id, token, label: nullable(label), role, expires_at: intOrNull(expires_at), used_at: intOrNull(used_at)};
	},

	/** One crew user by name (primary oracle for user-mutation flows). Null
	 *  when no such user. `active` via parseSqlBoolean. */
	crewUserByName(config: ConfigInfo, name: string): {name: string; role: string; active: boolean; label: string | null} | null {
		const out = orchardDbQuery(config, `SELECT name, role, active, label FROM users WHERE name = '${sqlEscape(name)}'`);
		if (out === '') return null;
		const [user_name, role, active, label] = cells(out);
		return {name: user_name, role, active: parseSqlBoolean(active), label: nullable(label)};
	},

	/** Full crew roster, creation order. Convenience for asserting exactly
	 *  which users exist (e.g. admin + reader). */
	crewUsers(config: ConfigInfo): Array<{name: string; role: string; active: boolean; label: string | null}> {
		const out = orchardDbQuery(config, 'SELECT name, role, active, label FROM users ORDER BY created_at');
		if (out === '') return [];
		return out.split('\n').map((row) => {
			const [name, role, active, label] = cells(row);
			return {name, role, active: parseSqlBoolean(active), label: nullable(label)};
		});
	},
};
