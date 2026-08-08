/* Local Dependencies */
import {AgentToolCategory, AgentToolName, AgentToolRole} from '../agent.enums.js';
import type {AiToolEntry} from '#server/modules/ai/tools/tool.types';

/* *******************************************************
	GraphQL Queries
******************************************************** */

const GET_PUBLIC_URLS_QUERY = `
	query GetPublicUrls($urls: [String!]!) {
		public_urls(urls: $urls) {
			url
			status
			ip_address
			has_data
		}
	}
`;

const GET_PUBLIC_PORTS_QUERY = `
	query GetPublicPorts($targets: [PublicPortInput!]!) {
		public_ports(targets: $targets) {
			host
			port
			reachable
			error
			latency_ms
		}
	}
`;

/* *******************************************************
	Tool Definitions
******************************************************** */

/** Checks liveness of public HTTP endpoints by URL */
export const GetUrlHealthTool: AiToolEntry = {
	category: AgentToolCategory.HEALTH,
	role: AgentToolRole.READ,
	title: 'URL Health',
	description: 'Check liveness of public HTTP endpoints by URL.',
	tool: {
		type: 'function',
		function: {
			name: AgentToolName.GET_URL_HEALTH,
			description: [
				'Check the liveness of public-facing HTTP endpoints.',
				'',
				'**Returns** (per URL):',
				'- `status` — HTTP status code (200 = healthy)',
				'- `ip_address` — resolved IP address',
				'- `has_data` — whether the endpoint returned a valid response body',
				'',
				'**Interpretation:**',
				'- Status codes outside 2xx indicate the endpoint is down or misconfigured',
				'- `has_data: false` with status 200 may indicate an empty or broken response',
				'- Compare resolved IPs against expected values to detect DNS issues',
			].join('\n'),
			parameters: {
				type: 'object',
				properties: {
					urls: {
						type: 'array',
						description: 'List of URLs to check for liveness.',
						items: {
							type: 'string',
						},
					},
				},
				required: ['urls'],
			},
		},
	},
	query: GET_PUBLIC_URLS_QUERY,
	throttle_max_calls: 2,
	throttle_window_seconds: 60,
};

/** Checks TCP port reachability for host:port targets */
export const GetPortHealthTool: AiToolEntry = {
	category: AgentToolCategory.HEALTH,
	role: AgentToolRole.READ,
	title: 'Port Health',
	description: 'Check TCP port reachability for host:port targets.',
	tool: {
		type: 'function',
		function: {
			name: AgentToolName.GET_PORT_HEALTH,
			description: [
				'Check TCP port reachability for one or more host:port targets.',
				'',
				'**Returns** (per target):',
				'- `host` — the hostname or IP tested',
				'- `port` — the port number tested',
				'- `reachable` — `true` if a TCP connection succeeded',
				'- `error` — error message if connection failed (null when reachable)',
				'- `latency_ms` — connection latency in milliseconds (null when unreachable)',
				'',
				'**Interpretation:**',
				'- `reachable: false` means the service is down or the port is firewalled',
				'- High `latency_ms` (> 1000) may indicate network congestion or geographic distance',
				'- Supports `.onion` addresses (routed via SOCKS5 proxy automatically)',
			].join('\n'),
			parameters: {
				type: 'object',
				properties: {
					targets: {
						type: 'array',
						description: 'List of host:port targets to check.',
						items: {
							type: 'object',
							properties: {
								host: {
									type: 'string',
									description: 'Hostname or IP address to connect to.',
								},
								port: {
									type: 'number',
									description: 'TCP port number to connect to.',
								},
							},
							required: ['host', 'port'],
						},
					},
				},
				required: ['targets'],
			},
		},
	},
	query: GET_PUBLIC_PORTS_QUERY,
	throttle_max_calls: 2,
	throttle_window_seconds: 60,
};
