/* Local Dependencies */
import type {AiTool} from '../ai.types.js';
import {AgentToolCategory, AgentToolRole} from '../agent/agent.enums.js';

/* *******************************************************
	Agent Context
******************************************************** */

/** Identity context passed from agent execution into tool calls */
export type AiAgentContext = {
	agent_id: string;
	agent_name: string;
};

/* *******************************************************
	Tool Results
******************************************************** */

/** Result returned from a tool execution */
export type AiToolResult = {
	success: boolean;
	data?: unknown;
	error?: string;
};

/* *******************************************************
	Tool Guards
******************************************************** */

/** Identifiers for opt-in tool guards. Tool entries declare which guards apply via `guards`. */
export enum ToolGuardName {
	AnalyticsBucketBudget = 'analytics_bucket_budget',
	MintMetricsEnabled = 'mint_metrics_enabled',
	MintMetricsQueryBudget = 'mint_metrics_query_budget',
}

/** Context passed to a guard when inspecting a pending tool call */
export type ToolGuardContext = {
	tool_name: string;
	variables: Record<string, unknown>;
};

/**
 * A guard inspects a pending tool call and either approves it (returns null)
 * or rejects it with a teaching error message that the model can act on.
 */
export type ToolGuard = (context: ToolGuardContext) => string | null;

/* *******************************************************
	Tool Handlers
******************************************************** */

/** Custom handler function for non-GraphQL tools */
export type AiToolHandler = (args: Record<string, unknown>) => Promise<AiToolResult>;

/* *******************************************************
	Tool Registry
******************************************************** */

/**
 * Registration entry for an AI tool.
 * Supports two execution modes:
 * - `query`: GraphQL query string executed against the compiled schema (default path for data tools)
 * - `handler`: Custom function for non-API tools (external APIs, calculations, messages, etc.)
 */
export type AiToolEntry = {
	tool: AiTool;
	category: AgentToolCategory;
	role: AgentToolRole;
	title: string;
	description: string;
	throttle_max_calls: number;
	throttle_window_seconds: number;
	query?: string;
	handler?: AiToolHandler;
	guards?: ToolGuardName[];
};
