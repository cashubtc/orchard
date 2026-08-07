/* Local Dependencies */
import {AgentToolCategory, AgentToolName, AgentToolRole} from '../agent.enums.js';
import {AiToolEntry, ToolGuardName} from '#server/modules/ai/tools/tool.types';

/* *******************************************************
	GraphQL Queries
******************************************************** */

const GET_LIGHTNING_INFO_QUERY = `
	query GetLightningInfo {
		lightning_info {
			version
			identity_pubkey
			alias
			color
			num_pending_channels
			num_active_channels
			num_inactive_channels
			num_peers
			block_height
			synced_to_chain
			synced_to_graph
			chains {
				chain
				network
			}
			uris
		}
	}
`;

const GET_LIGHTNING_ANALYTICS_BALANCES_QUERY = `
	query GetLightningAnalyticsBalances(
		$date_start: UnixTimestamp,
		$date_end: UnixTimestamp,
		$interval: AnalyticsInterval
	) {
		local_balance: lightning_analytics_local_balance(
			date_start: $date_start,
			date_end: $date_end,
			interval: $interval
		) {
			unit
			amount
			date
		}
		remote_balance: lightning_analytics_remote_balance(
			date_start: $date_start,
			date_end: $date_end,
			interval: $interval
		) {
			unit
			amount
			date
		}
	}
`;

const GET_LIGHTNING_ANALYTICS_METRICS_QUERY = `
	query GetLightningAnalyticsMetrics(
		$date_start: UnixTimestamp,
		$date_end: UnixTimestamp,
		$interval: AnalyticsInterval,
		$metrics: [LightningAnalyticsMetric!]
	) {
		lightning_analytics_metrics(
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

const GET_LIGHTNING_CHANNELS_QUERY = `
	query GetLightningChannels {
		lightning_channels {
			channel_point
			chan_id
			capacity
			local_balance
			remote_balance
			remote_pubkey
			peer_alias
			initiator
			push_amount_sat
			private
			active
			funding_txid
			asset {
				group_key
				asset_id
				name
				local_balance
				remote_balance
				capacity
				decimal_display
			}
		}
	}
`;

const GET_LIGHTNING_CLOSED_CHANNELS_QUERY = `
	query GetLightningClosedChannels {
		lightning_closed_channels {
			channel_point
			chan_id
			capacity
			close_height
			settled_balance
			time_locked_balance
			close_type
			open_initiator
			remote_pubkey
			funding_txid
			closing_txid
			asset {
				group_key
				asset_id
				name
				local_balance
				remote_balance
				capacity
				decimal_display
			}
		}
	}
`;

const GET_LIGHTNING_PEERS_QUERY = `
	query GetLightningPeers {
		lightning_peers {
			pubkey
			alias
			address
			bytes_sent
			bytes_recv
			sat_sent
			sat_recv
			inbound
			ping_time
		}
	}
`;

/* *******************************************************
	Tool Definitions
******************************************************** */

/** Fetches all open Lightning channels with balances and peer info */
export const GetLightningChannelsTool: AiToolEntry = {
	category: AgentToolCategory.LIGHTNING,
	role: AgentToolRole.READ,
	title: 'Channels',
	description: 'List all open Lightning channels with balances and peer info.',
	tool: {
		type: 'function',
		function: {
			name: AgentToolName.GET_LIGHTNING_CHANNELS,
			description: [
				'Retrieve all open Lightning channels.',
				'',
				'**Returns** per channel:',
				'- `chan_id` / `channel_point` — channel identifiers',
				'- `capacity` / `local_balance` / `remote_balance` — balances in **satoshis**',
				'- `remote_pubkey` — peer public key (cross-reference with `GET_LIGHTNING_PEERS`)',
				'- `peer_alias` — peer node alias (may be null)',
				'- `active` — whether the channel is currently online',
				'- `private` — whether the channel is unadvertised',
				'- `initiator` — true if we opened the channel',
				'- `funding_txid` — on-chain funding transaction',
				'- `asset` — Taproot Asset details if applicable (null otherwise)',
			].join('\n'),
			parameters: {
				type: 'object',
				properties: {},
			},
		},
	},
	query: GET_LIGHTNING_CHANNELS_QUERY,
	throttle_max_calls: 2,
	throttle_window_seconds: 60,
};

/** Fetches all closed Lightning channels with close details and peer info */
export const GetLightningClosedChannelsTool: AiToolEntry = {
	category: AgentToolCategory.LIGHTNING,
	role: AgentToolRole.READ,
	title: 'Closed Channels',
	description: 'List all closed Lightning channels with close details.',
	tool: {
		type: 'function',
		function: {
			name: AgentToolName.GET_LIGHTNING_CLOSED_CHANNELS,
			description: [
				'Retrieve all closed Lightning channels.',
				'',
				'**Returns** per channel:',
				'- `chan_id` / `channel_point` — channel identifiers',
				'- `capacity` / `settled_balance` / `time_locked_balance` — amounts in **satoshis**',
				'- `remote_pubkey` — peer public key (cross-reference with `GET_LIGHTNING_PEERS`)',
				'- `close_type` — how the channel closed: `COOPERATIVE`, `LOCAL_FORCE`, `REMOTE_FORCE`, `BREACH`, `FUNDING_CANCELED`, `ABANDONED`, `UNKNOWN`',
				'- `open_initiator` — who opened: `LOCAL`, `REMOTE`, `BOTH`, `UNKNOWN`',
				'- `close_height` — block height at which the channel closed',
				'- `funding_txid` / `closing_txid` — on-chain transactions',
				'- `asset` — Taproot Asset details if applicable (null otherwise)',
				'',
				'**Severity guidance:** `BREACH` and `REMOTE_FORCE` closes warrant operator attention.',
			].join('\n'),
			parameters: {
				type: 'object',
				properties: {},
			},
		},
	},
	query: GET_LIGHTNING_CLOSED_CHANNELS_QUERY,
	throttle_max_calls: 2,
	throttle_window_seconds: 60,
};

/** Fetches all connected Lightning peers */
export const GetLightningPeersTool: AiToolEntry = {
	category: AgentToolCategory.LIGHTNING,
	role: AgentToolRole.READ,
	title: 'Peers',
	description: 'List all connected Lightning peers with traffic stats.',
	tool: {
		type: 'function',
		function: {
			name: AgentToolName.GET_LIGHTNING_PEERS,
			description: [
				'Retrieve all connected Lightning peers.',
				'',
				'**Returns** per peer:',
				'- `pubkey` — peer public key (matches `remote_pubkey` on channels)',
				'- `alias` — peer node alias (may be null)',
				'- `address` — network address',
				'- `bytes_sent` / `bytes_recv` — traffic counters',
				'- `sat_sent` / `sat_recv` — satoshis exchanged with this peer',
				'- `inbound` — whether the peer initiated the connection',
				'- `ping_time` — latency in milliseconds',
				'',
				'Some fields may be null depending on the Lightning backend (CLN exposes fewer peer details than LND).',
			].join('\n'),
			parameters: {
				type: 'object',
				properties: {},
			},
		},
	},
	query: GET_LIGHTNING_PEERS_QUERY,
	throttle_max_calls: 2,
	throttle_window_seconds: 60,
};

/** Fetches lightning balance analytics (local + remote) */
export const GetLightningAnalyticsBalancesTool: AiToolEntry = {
	category: AgentToolCategory.LIGHTNING,
	role: AgentToolRole.READ,
	title: 'Lightning Balances',
	description: 'Query Lightning channel balance trends over time.',
	tool: {
		type: 'function',
		function: {
			name: AgentToolName.GET_LIGHTNING_ANALYTICS_BALANCES,
			description: [
				'Retrieve Lightning channel balance analytics for a time range.',
				'',
				'**Returns** two derived balance categories, each with `unit`, `amount`, `date`:',
				'- `local_balance` — net local (outbound) capacity change per interval',
				'  Formula: channel_opens + invoices_in + forward_fees - payments_out - channel_closes',
				'- `remote_balance` — net remote (inbound) capacity change per interval',
				'  Formula: channel_opens_remote + payments_out - invoices_in - forward_fees - channel_closes_remote',
				'',
				'Amounts are in **millisatoshis** (1 sat = 1,000 msat).',
				'',
				'**Defaults:** `date_start` = all time, `date_end` = now. See parameter docs for when to scope `date_start` vs leave it open.',
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
				},
			},
		},
	},
	query: GET_LIGHTNING_ANALYTICS_BALANCES_QUERY,
	throttle_max_calls: 15,
	throttle_window_seconds: 60,
	guards: [ToolGuardName.AnalyticsBucketBudget],
};

/** Fetches lightning per-metric analytics with optional filters */
export const GetLightningAnalyticsMetricsTool: AiToolEntry = {
	category: AgentToolCategory.LIGHTNING,
	role: AgentToolRole.READ,
	title: 'Lightning Analytics',
	description: 'Query Lightning payment, routing, and channel analytics over time.',
	tool: {
		type: 'function',
		function: {
			name: AgentToolName.GET_LIGHTNING_ANALYTICS_METRICS,
			description: [
				'Retrieve raw Lightning network activity metrics for a time range.',
				'',
				'**Returns** per metric per interval bucket: `unit`, `metric`, `amount`, `date`, `count`.',
				'Amounts are in **millisatoshis** (1 sat = 1,000 msat).',
				'',
				'**Available metrics:**',
				'- `payments_out` — outgoing payments sent',
				'- `invoices_in` — incoming payments received',
				'- `forward_fees` — fees earned from routing',
				'- `payments_failed` / `payments_pending` — unsuccessful or in-flight payments',
				'- `channel_opens` / `channel_closes` — locally-initiated channel events',
				'- `channel_opens_remote` / `channel_closes_remote` — remotely-initiated channel events',
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
							enum: [
								'payments_out',
								'payments_failed',
								'payments_pending',
								'invoices_in',
								'forward_fees',
								'channel_opens',
								'channel_closes',
								'channel_opens_remote',
								'channel_closes_remote',
							],
						},
					},
				},
			},
		},
	},
	query: GET_LIGHTNING_ANALYTICS_METRICS_QUERY,
	throttle_max_calls: 15,
	throttle_window_seconds: 60,
	guards: [ToolGuardName.AnalyticsBucketBudget],
};

/** Fetches lightning node identity and status information */
export const GetLightningInfoTool: AiToolEntry = {
	category: AgentToolCategory.LIGHTNING,
	role: AgentToolRole.READ,
	title: 'Lightning Info',
	description: 'Get Lightning node identity, sync status, and channel counts.',
	tool: {
		type: 'function',
		function: {
			name: AgentToolName.GET_LIGHTNING_INFO,
			description: [
				'Retrieve Lightning node identity and operational status.',
				'',
				'**Returns:**',
				'- `identity_pubkey` / `alias` / `color` — node identity',
				'- `version` — LN implementation version',
				'- `num_active_channels` / `num_inactive_channels` / `num_pending_channels` — channel counts by state',
				'- `num_peers` — connected peer count',
				'- `synced_to_chain` / `synced_to_graph` — whether the node is caught up',
				'- `block_height` — latest block the LN node is aware of',
				'- `uris` — public connection URIs',
			].join('\n'),
			parameters: {
				type: 'object',
				properties: {},
			},
		},
	},
	query: GET_LIGHTNING_INFO_QUERY,
	throttle_max_calls: 2,
	throttle_window_seconds: 60,
};
