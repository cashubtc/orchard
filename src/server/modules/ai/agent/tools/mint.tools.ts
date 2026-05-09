/* Local Dependencies */
import {AgentToolCategory, AgentToolName, AgentToolRole} from '../agent.enums';
import {AiToolEntry, ToolGuardName} from '@server/modules/ai/tools/tool.types';

/* *******************************************************
	GraphQL Queries
******************************************************** */

const GET_MINT_ANALYTICS_QUERY = `
	query GetMintAnalytics(
		$units: [MintUnit!],
		$date_start: UnixTimestamp,
		$date_end: UnixTimestamp,
		$interval: AnalyticsInterval
	) {
		balances: mint_analytics_balances(units: $units, date_start: $date_start, date_end: $date_end, interval: $interval) {
			unit
			amount
			date
			count
		}
		mints: mint_analytics_mints(units: $units, date_start: $date_start, date_end: $date_end, interval: $interval) {
			unit
			amount
			date
			count
		}
		melts: mint_analytics_melts(units: $units, date_start: $date_start, date_end: $date_end, interval: $interval) {
			unit
			amount
			date
			count
		}
		fees: mint_analytics_fees(units: $units, date_start: $date_start, date_end: $date_end, interval: $interval) {
			unit
			amount
			date
			count
		}
	}
`;

const GET_MINT_ANALYTICS_METRICS_QUERY = `
	query GetMintAnalyticsMetrics(
		$units: [MintUnit!],
		$date_start: UnixTimestamp,
		$date_end: UnixTimestamp,
		$interval: AnalyticsInterval,
		$metrics: [MintAnalyticsMetric!]
	) {
		mint_analytics_metrics(units: $units, date_start: $date_start, date_end: $date_end, interval: $interval, metrics: $metrics) {
			unit
			metric
			amount
			date
			count
		}
	}
`;

const GET_MINT_INFO_QUERY = `
	query GetMintInfo {
		mint_info {
			name
			pubkey
			version
			description
			description_long
			contact {
				method
				info
			}
			icon_url
			urls
		}
	}
`;

/* *******************************************************
	Tool Definitions
******************************************************** */

/** Fetches cashu mint identity and configuration information */
export const GetMintInfoTool: AiToolEntry = {
	category: AgentToolCategory.MINT,
	role: AgentToolRole.READ,
	title: 'Mint Info',
	description: 'Get Cashu mint identity, version, and contact info.',
	tool: {
		type: 'function',
		function: {
			name: AgentToolName.GET_MINT_INFO,
			description: [
				'Retrieve Cashu mint identity and configuration.',
				'',
				'**Returns:**',
				'- `name` / `description` / `description_long` — mint branding and info',
				"- `pubkey` — the mint's public key",
				'- `version` — mint software version',
				'- `contact` — operator contact methods (e.g. email, nostr)',
				'- `icon_url` — mint icon URL',
				'- `urls` — public endpoint URLs',
			].join('\n'),
			parameters: {
				type: 'object',
				properties: {},
			},
		},
	},
	query: GET_MINT_INFO_QUERY,
	throttle_max_calls: 10,
	throttle_window_seconds: 60,
};

/** Fetches per-metric mint analytics with optional metric filtering */
export const GetMintAnalyticsMetricsTool: AiToolEntry = {
	category: AgentToolCategory.MINT,
	role: AgentToolRole.READ,
	title: 'Mint Metrics',
	description: 'Analyze mint and melt volumes, swap fees, and issuance over time.',
	tool: {
		type: 'function',
		function: {
			name: AgentToolName.GET_MINT_ANALYTICS_METRICS,
			description: [
				'Retrieve per-metric Cashu mint analytics for a time range.',
				'Returns individual metric data points, each with `unit`, `metric`, `amount`, `date`, `count`.',
				'',
				'**Available metrics:**',
				'- `mints_amount` — tokens issued (Lightning → ecash)',
				'- `mints_created` — mint quote count',
				'- `mints_completion_time` — average time to complete mint quotes',
				'- `melts_amount` — tokens redeemed (ecash → Lightning)',
				'- `melts_created` — melt quote count',
				'- `melts_completion_time` — average time to complete melt quotes',
				'- `swaps_amount` — swap volume',
				'- `issued_amount` — total promises (blind signatures) issued',
				'- `redeemed_amount` — total proofs redeemed',
				'- `fees_amount` — total fees collected',
				'',
				'**Usage:** Use the `metrics` parameter to filter for specific metrics. Omit to get all.',
				'**Defaults:** `date_start` = all time, `date_end` = now, `units` = all. See parameter docs for when to scope `date_start` vs leave it open.',
			].join('\n'),
			parameters: {
				type: 'object',
				properties: {
					units: {
						type: 'array',
						description: 'Filter by currency units. Defaults to all units if omitted.',
						items: {
							type: 'string',
							enum: ['sat', 'msat', 'usd', 'eur', 'btc'],
						},
					},
					date_start: {
						type: 'number',
						description:
							'Start of the time range as a unix timestamp in seconds. Defaults to 0 (all time). Set this for time-bounded questions (e.g. "this month", "last 7 days"); omit it for current-state or all-time queries (e.g. "current balance", "lifetime totals").',
					},
					date_end: {
						type: 'number',
						description: 'End of the time range as a unix timestamp in seconds. Defaults to now.',
					},
					interval: {
						type: 'string',
						description:
							'Aggregation bucket size. Use `hour`/`day`/`week`/`month` for time-series breakdowns over the range. Use `custom` to collapse the entire `date_start`–`date_end` window into a single aggregated bucket — ideal for all-time totals or totals over an arbitrary custom range.',
						enum: ['hour', 'day', 'week', 'month', 'custom'],
					},
					metrics: {
						type: 'array',
						description: 'Filter by specific metrics. Defaults to all non-keyset metrics if omitted.',
						items: {
							type: 'string',
							enum: [
								'mints_amount',
								'mints_created',
								'mints_completion_time',
								'melts_amount',
								'melts_created',
								'melts_completion_time',
								'swaps_amount',
								'issued_amount',
								'redeemed_amount',
								'fees_amount',
							],
						},
					},
				},
			},
		},
	},
	query: GET_MINT_ANALYTICS_METRICS_QUERY,
	throttle_max_calls: 15,
	throttle_window_seconds: 60,
	guards: [ToolGuardName.AnalyticsBucketBudget],
};

/** Fetches mint analytics for balances, mints, melts, and fees */
export const GetMintAnalyticsTool: AiToolEntry = {
	category: AgentToolCategory.MINT,
	role: AgentToolRole.READ,
	title: 'Mint Analytics',
	description: 'Track mint activity including balances, mints, melts, and fees.',
	tool: {
		type: 'function',
		function: {
			name: AgentToolName.GET_MINT_ANALYTICS,
			description: [
				'Retrieve Cashu mint operational metrics for a time range.',
				'',
				'**Returns** four metric categories, each with `unit`, `amount`, `date`, `count`:',
				'- `balances` — outstanding token supply (ecash in circulation)',
				'- `mints` — tokens issued (Lightning → ecash conversions)',
				'- `melts` — tokens redeemed (ecash → Lightning conversions)',
				'- `fees` — fees collected from mint/melt operations',
				'',
				'**Defaults:** `date_start` = all time (epoch 0), `date_end` = now, `units` = all. See parameter docs for when to scope `date_start` vs leave it open.',
			].join('\n'),
			parameters: {
				type: 'object',
				properties: {
					units: {
						type: 'array',
						description: 'Filter by currency units. Defaults to all units if omitted.',
						items: {
							type: 'string',
							enum: ['sat', 'msat', 'usd', 'eur', 'btc'],
						},
					},
					date_start: {
						type: 'number',
						description:
							'Start of the time range as a unix timestamp in seconds. Defaults to 0 (all time). Set this for time-bounded questions (e.g. "this month", "last 7 days"); omit it for current-state or all-time queries (e.g. "current balance", "lifetime totals").',
					},
					date_end: {
						type: 'number',
						description: 'End of the time range as a unix timestamp in seconds. Defaults to now.',
					},
					interval: {
						type: 'string',
						description:
							'Aggregation bucket size. Use `hour`/`day`/`week`/`month` for time-series breakdowns over the range. Use `custom` to collapse the entire `date_start`–`date_end` window into a single aggregated bucket — ideal for all-time totals or totals over an arbitrary custom range.',
						enum: ['hour', 'day', 'week', 'month', 'custom'],
					},
				},
			},
		},
	},
	query: GET_MINT_ANALYTICS_QUERY,
	throttle_max_calls: 15,
	throttle_window_seconds: 60,
	guards: [ToolGuardName.AnalyticsBucketBudget],
};
