/* Core Dependencies */
import {registerEnumType} from '@nestjs/graphql';
/* Application Dependencies */
import {
	LightningAddressType,
	LightningRequestType,
	LightningChannelCloseType,
	LightningChannelOpenInitiator,
} from '@server/modules/lightning/lightning.enums';
import {TaprootAssetType, TaprootAssetVersion} from '@server/modules/tapass/tapass.enums';
import {MintActivityPeriod} from '@server/modules/cashu/mintdb/cashumintdb.enums';
import {AnalyticsInterval} from '@server/modules/analytics/analytics.enums';
import {MintAnalyticsMetric} from '@server/modules/cashu/mintanalytics/mintanalytics.enums';
import {LightningAnalyticsMetric} from '@server/modules/lightning/analytics/lnanalytics.enums';
import {BitcoinAnalyticsMetric} from '@server/modules/bitcoin/analytics/btcanalytics.enums';
import {MintUnit, MintQuoteState, MeltQuoteState, MintProofState} from '@server/modules/cashu/cashu.enums';
import {AiMessageRole} from '@server/modules/ai/ai.enums';
import {AssistantToolName, AiAssistant} from '@server/modules/ai/assistant/ai.assistant.enums';
import {AgentKey, AgentRunStatus, AgentScheduleKind} from '@server/modules/ai/agent/agent.enums';
import {UserRole} from '@server/modules/user/user.enums';
import {SettingKey, SettingValue} from '@server/modules/setting/setting.enums';
import {UTXOracleProgressStatus} from '@server/modules/bitcoin/utxoracle/utxoracle.enums';
import {
	EventLogActorType,
	EventLogSection,
	EventLogEntityType,
	EventLogType,
	EventLogStatus,
	EventLogDetailStatus,
} from '@server/modules/event/event.enums';
import {SystemMetric, SystemMetricsInterval} from '@server/modules/system/metrics/sysmetrics.enums';
import {MintMetricType} from '@server/modules/cashu/mintmetrics/mintmetrics.enums';

registerEnumType(MintUnit, {
	name: 'MintUnit',
	description: 'Supported currency units for Cashu mints',
	valuesMap: {
		sat: {description: 'Bitcoin satoshis'},
		msat: {description: 'Bitcoin millisatoshis'},
		usd: {description: 'US dollars'},
		eur: {description: 'Euros'},
		btc: {description: 'Bitcoin'},
		auth: {description: 'Authentication token'},
	},
});
registerEnumType(MintQuoteState, {
	name: 'MintQuoteState',
	description: 'State of a Cashu mint quote',
	valuesMap: {
		UNPAID: {description: 'Quote has not been paid'},
		PENDING: {description: 'Payment is pending confirmation'},
		PAID: {description: 'Payment has been confirmed'},
		ISSUED: {description: 'Tokens have been issued'},
	},
});
registerEnumType(MeltQuoteState, {
	name: 'MeltQuoteState',
	description: 'State of a Cashu melt quote',
	valuesMap: {
		UNPAID: {description: 'Quote has not been paid'},
		PENDING: {description: 'Payment is pending confirmation'},
		PAID: {description: 'Payment has been confirmed'},
	},
});
registerEnumType(MintProofState, {
	name: 'MintProofState',
	description: 'State of a Cashu proof',
	valuesMap: {
		SPENT: {description: 'Proof has been spent'},
	},
});
registerEnumType(AnalyticsInterval, {
	name: 'AnalyticsInterval',
	description: 'Time interval for analytics aggregation',
	valuesMap: {
		hour: {description: 'Hourly aggregation'},
		day: {description: 'Daily aggregation'},
		week: {description: 'Weekly aggregation'},
		month: {description: 'Monthly aggregation'},
		custom: {description: 'Custom time range'},
	},
});
registerEnumType(MintActivityPeriod, {
	name: 'MintActivityPeriod',
	description: 'Time period for mint activity summaries',
	valuesMap: {
		day: {description: 'Last 24 hours'},
		three_day: {description: 'Last 3 days'},
		week: {description: 'Last 7 days'},
	},
});
registerEnumType(TaprootAssetType, {
	name: 'TaprootAssetType',
	description: 'Type of Taproot asset',
	valuesMap: {
		NORMAL: {description: 'Fungible asset'},
		COLLECTIBLE: {description: 'Non-fungible collectible asset'},
	},
});
registerEnumType(TaprootAssetVersion, {
	name: 'TaprootAssetVersion',
	description: 'Taproot asset protocol version',
	valuesMap: {
		ASSET_VERSION_V0: {description: 'Version 0'},
		ASSET_VERSION_V1: {description: 'Version 1'},
	},
});
registerEnumType(LightningAddressType, {
	name: 'LightningAddressType',
	description: 'Lightning node address type',
	valuesMap: {
		UNKNOWN: {description: 'Unknown address type'},
		WITNESS_PUBKEY_HASH: {description: 'Native SegWit (P2WPKH)'},
		NESTED_WITNESS_PUBKEY_HASH: {description: 'Nested SegWit (P2SH-P2WPKH)'},
		HYBRID_NESTED_WITNESS_PUBKEY_HASH: {description: 'Hybrid nested SegWit'},
		TAPROOT_PUBKEY: {description: 'Taproot (P2TR)'},
	},
});
registerEnumType(LightningRequestType, {
	name: 'LightningRequestType',
	description: 'Lightning payment request type',
	valuesMap: {
		BOLT11_INVOICE: {description: 'BOLT11 Lightning invoice'},
		BOLT12_OFFER: {description: 'BOLT12 offer'},
		BOLT12_INVOICE: {description: 'BOLT12 invoice'},
		BOLT12_INVOICE_REQUEST: {description: 'BOLT12 invoice request'},
		UNKNOWN: {description: 'Unknown request type'},
	},
});
registerEnumType(LightningChannelCloseType, {
	name: 'LightningChannelCloseType',
	description: 'How a Lightning channel was closed',
	valuesMap: {
		COOPERATIVE: {description: 'Cooperative close by both parties'},
		LOCAL_FORCE: {description: 'Force-closed by local node'},
		REMOTE_FORCE: {description: 'Force-closed by remote node'},
		BREACH: {description: 'Closed due to breach attempt'},
		FUNDING_CANCELED: {description: 'Funding transaction canceled'},
		ABANDONED: {description: 'Channel was abandoned'},
		UNKNOWN: {description: 'Unknown close type'},
	},
});
registerEnumType(LightningChannelOpenInitiator, {
	name: 'LightningChannelOpenInitiator',
	description: 'Who initiated the Lightning channel open',
	valuesMap: {
		LOCAL: {description: 'Opened by local node'},
		REMOTE: {description: 'Opened by remote node'},
		BOTH: {description: 'Dual-funded channel'},
		UNKNOWN: {description: 'Unknown initiator'},
	},
});
registerEnumType(LightningAnalyticsMetric, {
	name: 'LightningAnalyticsMetric',
	description: 'Lightning network analytics metrics',
	valuesMap: {
		payments_out: {description: 'Outgoing payments'},
		payments_failed: {description: 'Failed payments'},
		payments_pending: {description: 'Pending payments'},
		invoices_in: {description: 'Incoming invoices'},
		forward_fees: {description: 'Routing forward fees earned'},
		channel_opens: {description: 'Local channel opens'},
		channel_closes: {description: 'Local channel closes'},
		channel_opens_remote: {description: 'Remote channel opens'},
		channel_closes_remote: {description: 'Remote channel closes'},
	},
});
registerEnumType(BitcoinAnalyticsMetric, {
	name: 'BitcoinAnalyticsMetric',
	description: 'Bitcoin on-chain analytics metrics',
	valuesMap: {
		payments_in: {description: 'Incoming on-chain payments'},
		payments_out: {description: 'Outgoing on-chain payments'},
		fees: {description: 'Transaction fees paid'},
	},
});
registerEnumType(MintAnalyticsMetric, {
	name: 'MintAnalyticsMetric',
	description: 'Cashu mint analytics metrics',
	valuesMap: {
		mints_amount: {description: 'Total minted amount'},
		mints_created: {description: 'Number of mint quotes created'},
		mints_completion_time: {description: 'Average mint completion time'},
		melts_amount: {description: 'Total melted amount'},
		melts_created: {description: 'Number of melt quotes created'},
		melts_completion_time: {description: 'Average melt completion time'},
		swaps_amount: {description: 'Total swap amount'},
		issued_amount: {description: 'Total tokens issued'},
		redeemed_amount: {description: 'Total tokens redeemed'},
		fees_amount: {description: 'Total fees collected'},
		keyset_issued: {description: 'Tokens issued per keyset'},
		keyset_redeemed: {description: 'Tokens redeemed per keyset'},
	},
});
registerEnumType(AgentKey, {
	name: 'AgentKey',
	description: 'AI agent identifiers',
	valuesMap: {
		GROUNDSKEEPER: {description: 'Main Groundskeeper agent'},
		ACTIVITY_MONITOR: {description: 'Automated activity monitoring agent'},
	},
});
registerEnumType(AgentScheduleKind, {
	name: 'AgentScheduleKind',
	description: 'Type of schedule for an AI agent',
	valuesMap: {
		CRON: {description: 'Cron-based schedule'},
	},
});
registerEnumType(AgentRunStatus, {
	name: 'AgentRunStatus',
	description: 'Status of an AI agent run',
	valuesMap: {
		RUNNING: {description: 'Agent is currently running'},
		SUCCESS: {description: 'Agent completed successfully'},
		ERROR: {description: 'Agent encountered an error'},
	},
});
registerEnumType(AiAssistant, {
	name: 'AiAssistant',
	description: 'AI assistant context identifiers',
	valuesMap: {
		DEFAULT: {description: 'Default assistant context'},
		INDEX_CREW: {description: 'Crew management page assistant'},
		INDEX_CREW_INVITE: {description: 'Crew invite management assistant'},
		INDEX_CREW_USER: {description: 'Crew user management assistant'},
		MINT_DASHBOARD: {description: 'Mint dashboard assistant'},
		MINT_INFO: {description: 'Mint information page assistant'},
		MINT_CONFIG: {description: 'Mint configuration assistant'},
		MINT_KEYSETS: {description: 'Mint keysets management assistant'},
		MINT_KEYSET_ROTATION: {description: 'Keyset rotation assistant'},
		MINT_DATABASE: {description: 'Mint database management assistant'},
		MINT_BACKUP: {description: 'Mint backup management assistant'},
		SYSTEM: {description: 'System metrics assistant'},
		EVENT_LOG: {description: 'Event log assistant'},
		SETTINGS_AGENT: {description: 'Agent settings configuration assistant'},
	},
});
registerEnumType(AiMessageRole, {
	name: 'AiMessageRole',
	description: 'Role of a message in an AI conversation',
	valuesMap: {
		USER: {description: 'Message from the user'},
		ASSISTANT: {description: 'Message from the AI assistant'},
		TOOL: {description: 'Tool execution result'},
		SYSTEM: {description: 'System prompt or instruction'},
		ERROR: {description: 'Error message'},
	},
});
registerEnumType(AssistantToolName, {
	name: 'AssistantToolName',
	description: 'Tools available to AI assistants for performing actions',
});
registerEnumType(UserRole, {
	name: 'UserRole',
	description: 'User permission roles',
	valuesMap: {
		ADMIN: {description: 'Full administrative access'},
		MANAGER: {description: 'Management-level access'},
		READER: {description: 'Read-only access'},
		AGENT: {description: 'AI agent service account'},
	},
});
registerEnumType(SettingKey, {
	name: 'SettingKey',
	description: 'Application setting configuration keys',
	valuesMap: {
		BITCOIN_ORACLE: {description: 'Bitcoin price oracle toggle'},
		MINT_METRICS_API: {description: 'Mint prometheus exporter base url'},
		AI_ENABLED: {description: 'AI features toggle'},
		AI_VENDOR: {description: 'AI vendor selection'},
		AI_OLLAMA_API: {description: 'Ollama API endpoint'},
		AI_OPENROUTER_KEY: {description: 'OpenRouter API key'},
		MESSAGES_ENABLED: {description: 'Messaging notifications toggle'},
		MESSAGES_VENDOR: {description: 'Messaging vendor selection'},
		MESSAGES_TELEGRAM_BOT_TOKEN: {description: 'Telegram bot token'},
		SYSTEM_METRICS: {description: 'System metrics collection toggle'},
	},
});
registerEnumType(SettingValue, {
	name: 'SettingValue',
	description: 'Data types for setting values',
	valuesMap: {
		STRING: {description: 'String value'},
		NUMBER: {description: 'Numeric value'},
		BOOLEAN: {description: 'Boolean value'},
		JSON: {description: 'JSON object value'},
	},
});
registerEnumType(UTXOracleProgressStatus, {
	name: 'UTXOracleProgressStatus',
	description: 'Progress status of a UTXO oracle price calculation',
	valuesMap: {
		STARTED: {description: 'Calculation has started'},
		PROCESSING: {description: 'Calculation is in progress'},
		COMPLETED: {description: 'Calculation completed successfully'},
		ABORTED: {description: 'Calculation was aborted'},
		ERROR: {description: 'Calculation encountered an error'},
	},
});
registerEnumType(EventLogActorType, {
	name: 'EventLogActorType',
	description: 'Type of actor that triggered an event',
	valuesMap: {
		USER: {description: 'Human user action'},
		SYSTEM: {description: 'Automated system action'},
		AGENT: {description: 'AI agent action'},
	},
});
registerEnumType(EventLogSection, {
	name: 'EventLogSection',
	description: 'Application section where the event occurred',
	valuesMap: {
		BITCOIN: {description: 'Bitcoin module events'},
		LIGHTNING: {description: 'Lightning module events'},
		MINT: {description: 'Cashu mint module events'},
		ECASH: {description: 'Ecash module events'},
		AI: {description: 'AI module events'},
		SETTINGS: {description: 'Settings module events'},
	},
});
registerEnumType(EventLogEntityType, {
	name: 'EventLogEntityType',
	description: 'Type of entity affected by the event',
	valuesMap: {
		INFO: {description: 'General information entity'},
		QUOTE: {description: 'Quote entity'},
		QUOTE_TTL: {description: 'Quote time-to-live setting'},
		NUT04: {description: 'NUT-04 mint method configuration'},
		NUT05: {description: 'NUT-05 melt method configuration'},
		KEYSET: {description: 'Keyset entity'},
		DATABASE: {description: 'Database entity'},
		SETTING: {description: 'Setting entity'},
		AGENT: {description: 'AI agent entity'},
	},
});
registerEnumType(EventLogType, {
	name: 'EventLogType',
	description: 'Type of operation performed',
	valuesMap: {
		CREATE: {description: 'Entity was created'},
		UPDATE: {description: 'Entity was updated'},
		DELETE: {description: 'Entity was deleted'},
		EXECUTE: {description: 'Operation was executed'},
	},
});
registerEnumType(EventLogStatus, {
	name: 'EventLogStatus',
	description: 'Overall status of the event',
	valuesMap: {
		SUCCESS: {description: 'Event completed successfully'},
		PARTIAL: {description: 'Event partially completed'},
		ERROR: {description: 'Event failed with an error'},
	},
});
registerEnumType(EventLogDetailStatus, {
	name: 'EventLogDetailStatus',
	description: 'Status of an individual event detail entry',
	valuesMap: {
		SUCCESS: {description: 'Detail completed successfully'},
		ERROR: {description: 'Detail failed with an error'},
	},
});
registerEnumType(SystemMetric, {
	name: 'SystemMetric',
	description: 'System performance metrics',
	valuesMap: {
		cpu_percent: {description: 'CPU usage percentage'},
		memory_percent: {description: 'Memory usage percentage'},
		memory_rss_mb: {description: 'Process resident set size in MB'},
		disk_percent: {description: 'Disk usage percentage'},
		load_avg_1m: {description: '1-minute load average'},
		load_avg_5m: {description: '5-minute load average'},
		load_avg_15m: {description: '15-minute load average'},
		heap_used_mb: {description: 'Node.js heap used in MB'},
		heap_total_mb: {description: 'Node.js total heap in MB'},
		uptime_system: {description: 'System uptime in seconds'},
		uptime_process: {description: 'Process uptime in seconds'},
	},
});
registerEnumType(SystemMetricsInterval, {
	name: 'SystemMetricsInterval',
	description: 'Time interval for system metrics collection',
	valuesMap: {
		minute: {description: 'Per-minute collection'},
		hour: {description: 'Per-hour collection'},
		day: {description: 'Per-day collection'},
	},
});
registerEnumType(MintMetricType, {
	name: 'MintMetricType',
	description: 'Type of a mint prometheus metric',
	valuesMap: {
		gauge: {description: 'Point-in-time value'},
		counter: {description: 'Monotonic cumulative value'},
		histogram: {description: 'Distribution of observed values'},
	},
});
