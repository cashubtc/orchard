/* Local Dependencies */
import {AgentToolCategory, AgentToolName, AgentToolRole} from '../agent.enums.js';
import {AiToolEntry} from '@server/modules/ai/tools/tool.types';

/* *******************************************************
	GraphQL Queries
******************************************************** */

const GET_PAST_RUNS_QUERY = `
	query GetPastRuns($agent_id: String!, $page: Int, $page_size: Int, $notified: Boolean) {
		ai_agent_runs(agent_id: $agent_id, page: $page, page_size: $page_size, notified: $notified) {
			status
			started_at
			completed_at
			result
		}
	}
`;

/* *******************************************************
	Tool Definitions
******************************************************** */

/** Retrieves past run results so the agent can avoid repeating messages */
export const GetPastRunsTool: AiToolEntry = {
	category: AgentToolCategory.MEMORY,
	role: AgentToolRole.READ,
	title: 'Past Runs',
	description: 'Retrieve past agent run results to review history and avoid duplicate messages.',
	tool: {
		type: 'function',
		function: {
			name: AgentToolName.GET_PAST_RUNS,
			description: [
				'Retrieve past runs to review your history.',
				'',
				'Call this **first** at the start of every run to review what you previously did.',
				'Use the `agent_id` from your runtime context.',
				'By default returns all runs unfiltered. Use `notified` to filter.',
				'',
				'**Returns** (most recent first):',
				'- `status` — run outcome (`success` or `error`)',
				'- `started_at` / `completed_at` — unix timestamps',
				'- `result` — your previous internal notes (what you checked, found, and notified)',
				'',
				'Cross-reference these notes before sending messages to avoid repeating the same findings.',
			].join('\n'),
			parameters: {
				type: 'object',
				properties: {
					agent_id: {
						type: 'string',
						description: 'Your agent ID (from runtime context).',
					},
					page: {
						type: 'integer',
						description: 'Page number (0 = most recent runs). Increase to look further into the past.',
					},
					page_size: {
						type: 'integer',
						description: 'Number of runs per page (default: 10).',
					},
					notified: {
						type: 'boolean',
						description:
							'Filter by notification status. true = only runs where messages were sent, false = only runs with no messages. Omit for all runs.',
					},
				},
				required: ['agent_id'],
			},
		},
	},
	query: GET_PAST_RUNS_QUERY,
	throttle_max_calls: 3,
	throttle_window_seconds: 60,
};
