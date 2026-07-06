/**
 * Shared SQL transport primitives for backend readers that need to query
 * the mint daemon's database or Orchard's own database.
 *
 * Postgres reads go via `docker exec psql -tAc` against the postgres
 * container. SQLite reads go via `docker exec sqlite3 ...` against the
 * stack's `sqlite-reader` sidecar (alpine + sqlite, defined in each
 * compose.yml). The sidecar shares the relevant data volume with the
 * writer container, so SQLite's WAL coordination just works — no
 * `docker cp` of `.sqlite + -wal + -shm`, no torn-page or stale-sidecar
 * races, no host-side `sqlite3` dependency.
 */

/* Native Dependencies */
import {dockerExec} from './docker-cli';
import type {ConfigInfo} from '@e2e/types/config';

/** Postgres database name per stack — every stack uses user `cashu`/pass `cashu`,
 *  but the database name is set by each compose file's `POSTGRES_DB` env. */
const MINT_PG_DB: Partial<Record<ConfigInfo['name'], string>> = {
	'fake-cdk-postgres': 'cdk_fake',
	'cln-cdk-postgres': 'cdk',
	'cln-nutshell-postgres': 'nutshell',
};

/** Path to the mint daemon's sqlite file as exposed inside the
 *  `sqlite-reader` sidecar — each stack's sidecar mounts the mint data
 *  volume at `/mint`. cdk-mintd writes a single `cdk-mintd.sqlite`;
 *  nutshell writes `mint.sqlite3`. */
const MINT_SQLITE_PATH: Record<'cdk' | 'nutshell', string> = {
	cdk: '/mint/cdk-mintd.sqlite',
	nutshell: '/mint/mint.sqlite3',
};

/** Path to Orchard's own sqlite database as exposed inside the
 *  `sqlite-reader` sidecar — every stack's sidecar mounts orchard's data
 *  volume at `/orchard`. Distinct from the mint daemon's DB; this is
 *  where Orchard persists settings, oracle backfills, analytics
 *  checkpoints, users. */
const ORCHARD_SQLITE_PATH = '/orchard/orchard.db';

/** Container name of the per-stack sqlite reader sidecar. Defined in
 *  each `e2e/docker/configs/<stack>/compose.yml` and named to match. */
function sqliteReaderContainer(config: ConfigInfo): string {
	return `${config.name}-sqlite-reader`;
}

/** Run a SQL read inside the sqlite-reader sidecar. The sidecar shares
 *  fs + page cache with the writer (mount of the same docker volume),
 *  so a `SELECT` here observes the writer's committed state with full
 *  WAL coordination — no copy-out, no `-wal`/`-shm` mismatches.
 *
 *  `-readonly` plus `-bail` keeps the connection from accidentally
 *  attempting to checkpoint or write back, and makes any SQL error
 *  surface as a non-zero exit (otherwise sqlite3 prints the error and
 *  returns 0, hiding bugs from the helper). Output is on stdout in
 *  the default pipe-separated format with no headers (`-noheader`,
 *  `-separator |`) — same shape every existing caller already parses. */
function sqliteContainerQuery(config: ConfigInfo, db_path: string, sql: string): string {
	return dockerExec([
		'exec',
		sqliteReaderContainer(config),
		'sqlite3',
		'-readonly',
		'-bail',
		'-noheader',
		'-separator',
		'|',
		// Busy handler: under full-matrix load orchard/the mint write while
		// we read, and a checkpoint-held lock otherwise bounces the query
		// with "database is locked (5)". 3s covers any realistic writer burst.
		'-cmd',
		'.timeout 3000',
		db_path,
		sql,
	]);
}

/** Parse the boolean text emitted by either `psql -tA` (`'t'` / `'f'`) or
 *  `sqlite3` (`'1'` / `'0'`). */
export function parseSqlBoolean(s: string): boolean {
	return s === 't' || s === '1' || s === 'true';
}

/** Run a one-shot SQL read against the stack's mint database, returning the
 *  raw stdout (whitespace-trimmed). Postgres uses `psql -tAc` for terse
 *  output; sqlite goes through the sqlite-reader sidecar. */
export function mintDbQuery(config: ConfigInfo, sql: string): string {
	if (config.db === 'postgres') {
		const db = MINT_PG_DB[config.name];
		if (!db) throw new Error(`MINT_PG_DB missing entry for ${config.name}`);
		const container = `${config.name}-postgres`;
		return dockerExec(['exec', container, 'psql', '-U', 'cashu', '-d', db, '-tAc', sql]);
	}
	return sqliteContainerQuery(config, MINT_SQLITE_PATH[config.mint], sql);
}

/** Run a one-shot SQL read against Orchard's own sqlite database. Every
 *  stack's sqlite-reader sidecar mounts the orchard volume at /orchard,
 *  so this works on postgres-mint stacks too — orchard's own state
 *  (settings, oracle backfill, analytics checkpoints) is always sqlite
 *  regardless of the mint backend. */
export function orchardDbQuery(config: ConfigInfo, sql: string): string {
	return sqliteContainerQuery(config, ORCHARD_SQLITE_PATH, sql);
}
