/* Local Dependencies */
import {AgentToolCategory, AgentToolName, AgentToolRole} from '../agent.enums';
import {AiToolEntry} from '@server/modules/ai/tools/tool.types';

/* *******************************************************
	GraphQL Queries
******************************************************** */

const GET_SYSTEM_METRICS_QUERY = `
	query GetSystemMetrics(
		$date_start: UnixTimestamp,
		$date_end: UnixTimestamp,
		$interval: SystemMetricsInterval,
		$timezone: Timezone,
		$metrics: [SystemMetric!]
	) {
		system_metrics(
			date_start: $date_start,
			date_end: $date_end,
			interval: $interval,
			timezone: $timezone,
			metrics: $metrics
		) {
			metric
			value
			min
			max
			date
		}
	}
`;

/* *******************************************************
	Tool Definitions
******************************************************** */

/** Fetches host system resource metrics (CPU, memory, disk, load, heap, uptime) */
export const GetSystemMetricsTool: AiToolEntry = {
	category: AgentToolCategory.SYSTEM,
	role: AgentToolRole.READ,
	title: 'System Metrics',
	description: 'Query host system CPU, memory, disk, and load metrics over time.',
	tool: {
		type: 'function',
		function: {
			name: AgentToolName.GET_SYSTEM_METRICS,
			description: [
				'Retrieve host system resource metrics over a time range.',
				'',
				'**Returns** per metric per interval bucket: `metric`, `value` (average), `min`, `max`, `date`.',
				'',
				'**Available metrics:**',
				'- `cpu_percent` — CPU utilization (0–100%)',
				'- `memory_percent` — RAM utilization (0–100%)',
				'- `memory_rss_mb` — application process resident memory in MB',
				'- `disk_percent` — Root filesystem utilization (0–100%)',
				'- `load_avg_1m` / `load_avg_5m` / `load_avg_15m` — system load averages',
				'- `heap_used_mb` / `heap_total_mb` — Node.js heap usage in MB',
				'- `memory_external_mb` — Node.js external (off-heap) memory in MB',
				'- `process_cpu_percent` — application process CPU as % of machine capacity (0–100%)',
				'- `uptime_system` — host uptime in seconds',
				'- `uptime_process` — application process uptime in seconds',
				'',
				'**Interpretation guidance:**',
				'- CPU or memory above 90% sustained — resource pressure, may degrade services.',
				'- Disk above 85% — risk of running out of space; above 95% is critical.',
				'- Load average exceeding CPU core count — system is overloaded.',
				'- Heap used approaching heap total — potential memory leak or OOM risk.',
				'- Uptime resets (sudden drop) — indicates a restart occurred.',
				'',
				'**Defaults:** `date_start` = last 90 days, `date_end` = now, `metrics` = all. Always provide a `date_start` to scope results.',
			].join('\n'),
			parameters: {
				type: 'object',
				properties: {
					date_start: {
						type: 'number',
						description:
							'Start of the time range as a unix timestamp in seconds. Defaults to 90 days ago. You should always set this.',
					},
					date_end: {
						type: 'number',
						description: 'End of the time range as a unix timestamp in seconds. Defaults to now.',
					},
					interval: {
						type: 'string',
						description: 'The aggregation interval for bucketing metrics data.',
						enum: ['minute', 'hour', 'day'],
					},
					timezone: {
						type: 'string',
						description: 'IANA timezone for date bucketing (e.g. "America/New_York"). Defaults to UTC.',
					},
					metrics: {
						type: 'array',
						description: 'Which metrics to include. Defaults to all metrics if omitted.',
						items: {
							type: 'string',
							enum: [
								'cpu_percent',
								'memory_percent',
								'memory_rss_mb',
								'disk_percent',
								'load_avg_1m',
								'load_avg_5m',
								'load_avg_15m',
								'heap_used_mb',
								'heap_total_mb',
								'memory_external_mb',
								'process_cpu_percent',
								'uptime_system',
								'uptime_process',
							],
						},
					},
				},
			},
		},
	},
	query: GET_SYSTEM_METRICS_QUERY,
	throttle_max_calls: 15,
	throttle_window_seconds: 60,
};
