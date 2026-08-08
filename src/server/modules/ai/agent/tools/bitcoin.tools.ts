/* Local Dependencies */
import {AgentToolCategory, AgentToolName, AgentToolRole} from '../agent.enums.js';
import {type AiToolEntry, ToolGuardName} from '#server/modules/ai/tools/tool.types';

/* *******************************************************
	GraphQL Queries
******************************************************** */

const GET_BITCOIN_NETWORK_INFO_QUERY = `
	query GetBitcoinNetworkInfo {
		bitcoin_network_info {
			version
			subversion
			protocolversion
			connections
			connections_in
			connections_out
			networkactive
			networks {
				name
				reachable
			}
			localaddresses {
				address
				port
			}
			warnings
		}
	}
`;

const GET_BITCOIN_BLOCKCHAIN_INFO_QUERY = `
	query GetBitcoinBlockchainInfo {
		bitcoin_blockchain_info {
			chain
			blocks
			headers
			bestblockhash
			difficulty
			verificationprogress
			initialblockdownload
			size_on_disk
			pruned
			warnings
		}
	}
`;

const GET_BITCOIN_ANALYTICS_METRICS_QUERY = `
	query GetBitcoinAnalyticsMetrics(
		$date_start: UnixTimestamp,
		$date_end: UnixTimestamp,
		$interval: AnalyticsInterval,
		$metrics: [BitcoinAnalyticsMetric!]
	) {
		bitcoin_analytics_metrics(
			date_start: $date_start,
			date_end: $date_end,
			interval: $interval,
			metrics: $metrics
		) {
			unit
			metric
			amount
			date
			count
		}
	}
`;

/* *******************************************************
	Tool Definitions
******************************************************** */

/** Fetches bitcoin network peer and connectivity information */
export const GetBitcoinNetworkInfoTool: AiToolEntry = {
	category: AgentToolCategory.BITCOIN,
	role: AgentToolRole.READ,
	title: 'Network Info',
	description: 'Check Bitcoin node peer connections and network status.',
	tool: {
		type: 'function',
		function: {
			name: AgentToolName.GET_BITCOIN_NETWORK_INFO,
			description: [
				'Retrieve Bitcoin node network and peer connectivity information.',
				'',
				'**Returns:**',
				'- `connections` / `connections_in` / `connections_out` — total, inbound, and outbound peer count',
				'- `networkactive` — whether networking is enabled',
				'- `networks` — list of network types (ipv4, ipv6, onion) and their reachability',
				'- `localaddresses` — addresses the node advertises to peers',
				'- `warnings` — any active warnings from the node',
			].join('\n'),
			parameters: {
				type: 'object',
				properties: {},
			},
		},
	},
	query: GET_BITCOIN_NETWORK_INFO_QUERY,
	throttle_max_calls: 2,
	throttle_window_seconds: 60,
};

/** Fetches bitcoin blockchain sync and chain state information */
export const GetBitcoinBlockchainInfoTool: AiToolEntry = {
	category: AgentToolCategory.BITCOIN,
	role: AgentToolRole.READ,
	title: 'Blockchain Info',
	description: 'Check Bitcoin blockchain sync progress and chain state.',
	tool: {
		type: 'function',
		function: {
			name: AgentToolName.GET_BITCOIN_BLOCKCHAIN_INFO,
			description: [
				'Retrieve Bitcoin blockchain sync status and chain state.',
				'',
				'**Returns:**',
				'- `chain` — network name (e.g. "main", "test", "regtest")',
				'- `blocks` / `headers` — synced block height vs. known header height',
				'- `verificationprogress` — sync progress from 0.0 to 1.0 (1.0 = fully synced)',
				'- `initialblockdownload` — `true` if still performing initial sync (IBD)',
				'- `size_on_disk` — blockchain data size in bytes',
				'- `pruned` — whether the node is pruning old blocks',
				'- `warnings` — any active warnings',
			].join('\n'),
			parameters: {
				type: 'object',
				properties: {},
			},
		},
	},
	query: GET_BITCOIN_BLOCKCHAIN_INFO_QUERY,
	throttle_max_calls: 2,
	throttle_window_seconds: 60,
};

/** Fetches bitcoin per-metric analytics with optional filters */
export const GetBitcoinAnalyticsMetricsTool: AiToolEntry = {
	category: AgentToolCategory.BITCOIN,
	role: AgentToolRole.READ,
	title: 'Bitcoin Analytics',
	description: 'Track on-chain payment activity and fees over time.',
	tool: {
		type: 'function',
		function: {
			name: AgentToolName.GET_BITCOIN_ANALYTICS_METRICS,
			description: [
				'Retrieve raw Bitcoin on-chain activity metrics for a time range.',
				'',
				'**Returns** per metric per interval bucket: `unit`, `metric`, `amount`, `date`, `count`.',
				'Amounts are in **satoshis** (for BTC) or the native unit for Taproot Assets.',
				'',
				'**Available metrics:**',
				'- `payments_in` — incoming on-chain payments received',
				'- `payments_out` — outgoing on-chain payments sent',
				'- `fees` — on-chain transaction fees paid',
				'',
				'**Defaults:** `date_start` = all time, `date_end` = now, `metrics` = all. See parameter docs for when to scope `date_start` vs leave it open.',
			].join('\n'),
			parameters: {
				type: 'object',
				properties: {
					date_start: {
						type: 'number',
						description:
							'Start of the time range as a unix timestamp in seconds. Defaults to 0 (all time). Set this for time-bounded questions (e.g. "this month", "last 7 days"); omit it for current-state or all-time queries (e.g. "lifetime totals").',
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
						description: 'Which metrics to include. Defaults to all metrics if omitted.',
						items: {
							type: 'string',
							enum: ['payments_in', 'payments_out', 'fees'],
						},
					},
				},
			},
		},
	},
	query: GET_BITCOIN_ANALYTICS_METRICS_QUERY,
	throttle_max_calls: 15,
	throttle_window_seconds: 60,
	guards: [ToolGuardName.AnalyticsBucketBudget],
};
