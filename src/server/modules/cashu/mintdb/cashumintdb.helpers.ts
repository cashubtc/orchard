/* Vendor Dependencies */
import {DateTime} from 'luxon';
/* Local Dependencies */
import type {CashuMintDatabase} from './cashumintdb.types.js';
import {MintDatabaseType} from './cashumintdb.enums.js';

interface BuildQueryOptions {
	db_type: MintDatabaseType;
	table_name: string;
	args?: Record<string, any>;
	field_mappings?: Record<string, string>;
	select_statement?: string;
	group_by?: string;
	time_is_epoch_seconds?: boolean;
}

/**
 * Builds a dynamic SQL query with parameters based on provided arguments
 * @returns Object containing SQL query string and parameters array
 */
export function buildDynamicQuery(options: BuildQueryOptions): {sql: string; params: any[]} {
	const {db_type, table_name, args, field_mappings, select_statement, group_by, time_is_epoch_seconds} = options;
	let sql = select_statement || `SELECT * FROM ${table_name}`;
	const conditions: string[] = [];
	const params: any[] = [];
	const page_size = args?.page_size || 500;
	const page = args?.page || 1;
	const offset = (page - 1) * page_size;

	if (args && field_mappings) {
		Object.entries(args).forEach(([arg_key, arg_value]) => {
			processQueryArgument(db_type, arg_key, arg_value, field_mappings, conditions, params, time_is_epoch_seconds);
		});
	}

	if (conditions.length > 0) sql += ` WHERE ${conditions.join(' AND ')}`;
	if (group_by) sql += ` GROUP BY ${group_by}`;
	const sort_order = args?.sort_order === 'ASC' ? 'ASC' : 'DESC';
	sql += ` ORDER BY ${field_mappings?.date_start || 'created_time'} ${sort_order}`;
	sql += ` LIMIT ${page_size}`;
	if (offset > 0) sql += ` OFFSET ${offset}`;
	return {sql: sql + ';', params};
}

/**
 * Builds a count SQL query with parameters based on provided arguments
 * @returns Object containing SQL query string and parameters array
 */
export function buildCountQuery(options: BuildQueryOptions): {sql: string; params: any[]} {
	const {db_type, table_name, args, field_mappings, select_statement, group_by, time_is_epoch_seconds} = options;
	let sql = select_statement || `SELECT COUNT(*) AS count FROM ${table_name}`;
	const conditions: string[] = [];
	const params: any[] = [];
	if (args && field_mappings) {
		Object.entries(args).forEach(([arg_key, arg_value]) => {
			processQueryArgument(db_type, arg_key, arg_value, field_mappings, conditions, params, time_is_epoch_seconds);
		});
	}
	if (conditions.length > 0) sql += ` WHERE ${conditions.join(' AND ')}`;
	if (group_by) sql += ` GROUP BY ${group_by}`;
	return {sql: sql + ';', params};
}

/**
 * Processes a single argument and adds appropriate conditions and parameters
 * @param argKey The argument key
 * @param argValue The argument value
 * @param fieldMappings Maps argument fields to database columns
 * @param conditions Array of SQL conditions to append to
 * @param params Array of parameters to append to
 * @returns void - modifies conditions and params arrays in place
 */
export function processQueryArgument(
	db_type: MintDatabaseType,
	arg_key: string,
	arg_value: any,
	field_mappings: Record<string, string>,
	conditions: string[],
	params: any[],
	time_is_epoch_seconds?: boolean,
): void {
	if (arg_value === undefined) return;
	if (!(arg_key in field_mappings)) return;

	const db_field = field_mappings[arg_key];

	// Handle array values (IN clause)
	if (Array.isArray(arg_value) && arg_value.length > 0) {
		conditions.push(`${db_field} IN (${arg_value.map(() => '?').join(', ')})`);
		params.push(...arg_value);
	}
	// Handle date range start
	else if (arg_key === 'date_start') {
		conditions.push(`${db_field} >= ?`);
		params.push(time_is_epoch_seconds ? arg_value : convertDateArgument(arg_value, db_type));
	}
	// Handle date range end
	else if (arg_key === 'date_end') {
		conditions.push(`${db_field} <= ?`);
		params.push(time_is_epoch_seconds ? arg_value : convertDateArgument(arg_value, db_type));
	}
	// Handle regular equality comparison
	else if (arg_value !== null) {
		conditions.push(`${db_field} = ?`);
		params.push(arg_value);
	}
}

function convertDateArgument(date_arg: number, db_type: MintDatabaseType): number | string {
	if (db_type === MintDatabaseType.sqlite) return date_arg;
	return DateTime.fromSeconds(date_arg).toFormat('yyyy-MM-dd HH:mm:ss');
}

export async function queryRows<T>(client: CashuMintDatabase, sql: string, params?: any[]): Promise<T[]> {
	if (client.type === MintDatabaseType.sqlite) return client.database.prepare(sql).all(params ?? []) as T[];
	const pg_sql = convertSqlToType(sql, MintDatabaseType.postgres);
	return client.database.query(pg_sql, params).then((res) => res.rows as T[]);
}

export async function queryRow<T>(client: CashuMintDatabase, sql: string, params?: any[]): Promise<T> {
	if (client.type === MintDatabaseType.sqlite) return client.database.prepare(sql).get(params ?? []) as T;
	const pg_sql = convertSqlToType(sql, MintDatabaseType.postgres);
	return client.database.query(pg_sql, params).then((res) => res.rows[0] as T);
}

/**
 * Converts SQLite-style placeholders (?) to PostgreSQL-style placeholders ($1, $2, etc.)
 * and SQLite-specific functions to PostgreSQL equivalents
 * @param sql The SQL query string
 * @param db_type The database type to determine conversions
 * @returns The converted SQL query string
 */
export function convertSqlToType(sql: string, db_type: MintDatabaseType): string {
	if (db_type === MintDatabaseType.sqlite) return sql;
	let converted_sql = sql.replace(/json_group_array\(([^)]+)\)/g, 'json_agg($1)');
	let placeholder_count = 0;
	converted_sql = converted_sql.replace(/\?/g, () => {
		placeholder_count++;
		return `$${placeholder_count}`;
	});
	return converted_sql;
}

/**
 * Converts a date to a Unix timestamp
 * @param date_arg The date to convert
 * @returns The Unix timestamp in seconds
 */
export function convertDateToUnixTimestamp(date_arg: number | string | Date): number | null {
	if (typeof date_arg === 'number') return date_arg;
	if (typeof date_arg === 'string') {
		const parsed = Number(date_arg);
		return isNaN(parsed) ? null : parsed;
	}
	if (date_arg instanceof Date) return DateTime.fromJSDate(date_arg).toSeconds();
	return null;
}

export function extractRequestString(raw_request?: string | null): string | null {
	if (!raw_request) return null;
	const trimmed = raw_request.trim();
	if (!trimmed.startsWith('{')) return trimmed;

	try {
		const json: any = JSON.parse(trimmed);
		const offer_paths = ['offer', 'Bolt12.offer', 'bolt12.offer'];
		const invoice_paths = ['bolt11', 'Bolt11', 'Bolt11.bolt11', 'invoice'];
		const offer = findFirstString(json, offer_paths);
		if (offer) return offer;
		const bolt11 = findFirstString(json, invoice_paths);
		return bolt11 || trimmed;
	} catch {
		return trimmed;
	}
}

function findFirstString(obj: any, paths: string[]): string | undefined {
	for (const path of paths) {
		const val = getStringByPath(obj, path);
		if (val) return val;
	}
	return undefined;
}

function getStringByPath(obj: any, dot_path: string): string | undefined {
	let cur: any = obj;
	for (const key of dot_path.split('.')) {
		if (cur == null || typeof cur !== 'object') return undefined;
		cur = cur[key];
	}
	return typeof cur === 'string' && cur ? cur : undefined;
}
