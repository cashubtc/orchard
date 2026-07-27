/* Core Dependencies */
import {Injectable, Logger, Optional} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {ModuleRef} from '@nestjs/core';
/* Vendor Dependencies */
import {GraphQLSchemaHost} from '@nestjs/graphql';
import {DocumentNode, GraphQLSchema, execute, parse} from 'graphql';
import {DateTime} from 'luxon';
/* Application Dependencies */
import {AiTool} from '@server/modules/ai/ai.types';
import {AgentToolCategory, AgentToolName} from '@server/modules/ai/agent/agent.enums';
import {MintType} from '@server/modules/cashu/cashu.enums';
import {
	GetBitcoinAnalyticsMetricsTool,
	GetBitcoinBlockchainInfoTool,
	GetBitcoinNetworkInfoTool,
	GetPortHealthTool,
	GetUrlHealthTool,
	GetLightningAnalyticsBalancesTool,
	GetLightningAnalyticsMetricsTool,
	GetLightningChannelsTool,
	GetLightningClosedChannelsTool,
	GetLightningInfoTool,
	GetLightningPeersTool,
	GetMintAnalyticsMetricsTool,
	GetMintAnalyticsTool,
	GetMintInfoTool,
	GetMintMetricsTool,
	GetPastRunsTool,
	GetSystemMetricsTool,
	createSendMessageTool,
	SkipMessageTool,
} from '@server/modules/ai/agent/tools';
import {MessageService} from '@server/modules/message/message.service';
import {UserRole} from '@server/modules/user/user.enums';
/* Local Dependencies */
import {AiAgentContext, AiToolResult, AiToolEntry, ToolGuard, ToolGuardContext, ToolGuardName} from './tool.types';

@Injectable()
export class ToolService {
	private static readonly INTERVAL_SECONDS: Record<'minute' | 'hour' | 'day' | 'week' | 'month', number> = {
		minute: 60,
		hour: 3_600,
		day: 86_400,
		week: 604_800,
		month: 2_592_000,
	};
	private static readonly MAX_ANALYTICS_BUCKETS = 500;
	private static readonly MAX_MINT_METRIC_POINTS = 500;

	private readonly logger = new Logger(ToolService.name);
	private readonly registry = new Map<string, AiToolEntry>();
	private readonly call_log = new Map<string, number[]>();
	private readonly parsed_queries = new Map<string, DocumentNode>();
	private readonly guards: ReadonlyMap<ToolGuardName, ToolGuard> = new Map([
		[ToolGuardName.AnalyticsBucketBudget, (context: ToolGuardContext) => this.guardAnalyticsBucketBudget(context)],
		[ToolGuardName.MintMetricsEnabled, () => this.guardMintMetricsEnabled()],
		[ToolGuardName.MintMetricsQueryBudget, (context: ToolGuardContext) => this.guardMintMetricsQueryBudget(context)],
	]);
	private schema: GraphQLSchema | null = null;

	constructor(
		private readonly moduleRef: ModuleRef,
		private readonly configService: ConfigService,
		@Optional() private readonly messageService?: MessageService,
	) {
		this.register(AgentToolName.GET_BITCOIN_ANALYTICS_METRICS, GetBitcoinAnalyticsMetricsTool);
		this.register(AgentToolName.GET_BITCOIN_BLOCKCHAIN_INFO, GetBitcoinBlockchainInfoTool);
		this.register(AgentToolName.GET_BITCOIN_NETWORK_INFO, GetBitcoinNetworkInfoTool);
		this.register(AgentToolName.GET_PORT_HEALTH, GetPortHealthTool);
		this.register(AgentToolName.GET_URL_HEALTH, GetUrlHealthTool);
		this.register(AgentToolName.GET_LIGHTNING_ANALYTICS_BALANCES, GetLightningAnalyticsBalancesTool);
		this.register(AgentToolName.GET_LIGHTNING_ANALYTICS_METRICS, GetLightningAnalyticsMetricsTool);
		this.register(AgentToolName.GET_LIGHTNING_CHANNELS, GetLightningChannelsTool);
		this.register(AgentToolName.GET_LIGHTNING_CLOSED_CHANNELS, GetLightningClosedChannelsTool);
		this.register(AgentToolName.GET_LIGHTNING_INFO, GetLightningInfoTool);
		this.register(AgentToolName.GET_LIGHTNING_PEERS, GetLightningPeersTool);
		this.register(AgentToolName.GET_MINT_ANALYTICS, GetMintAnalyticsTool);
		this.register(AgentToolName.GET_MINT_ANALYTICS_METRICS, GetMintAnalyticsMetricsTool);
		this.register(AgentToolName.GET_MINT_INFO, GetMintInfoTool);
		this.register(AgentToolName.GET_MINT_METRICS, GetMintMetricsTool);
		this.register(AgentToolName.GET_PAST_RUNS, GetPastRunsTool);
		this.register(AgentToolName.GET_SYSTEM_METRICS, GetSystemMetricsTool);
		this.register(AgentToolName.SEND_MESSAGE, createSendMessageTool(this.messageService));
		this.register(AgentToolName.SKIP_MESSAGE, SkipMessageTool);
	}

	/* *******************************************************
		Registration
	******************************************************** */

	/** Register a tool entry in the registry, pre-parsing any GraphQL query */
	private register(name: AgentToolName, entry: AiToolEntry): void {
		this.registry.set(name, entry);
		if (entry.query) {
			this.parsed_queries.set(name, parse(entry.query));
		}
		this.logger.log(`Registered agent tool: ${name}`);
	}

	/* *******************************************************
		Schema Resolution
	******************************************************** */

	/** Get LLM-compatible tool schemas for a list of tool names */
	public getToolSchemas(tool_names: string[]): AiTool[] {
		return tool_names.map((name) => this.registry.get(name)?.tool).filter((t): t is AiTool => t !== undefined);
	}

	/** Get all registered tool names */
	public getRegisteredTools(): string[] {
		return Array.from(this.registry.keys());
	}

	/** Get all registered tool entries */
	public getRegisteredToolEntries(): AiToolEntry[] {
		return Array.from(this.registry.values());
	}

	/** Filter tool names to only those matching a specific category */
	public getToolNamesByCategory(tool_names: string[], category: AgentToolCategory): string[] {
		return tool_names.filter((name) => this.registry.get(name)?.category === category);
	}

	/** Filter tool names to exclude those matching a specific category */
	public getToolNamesExcludingCategory(tool_names: string[], category: AgentToolCategory): string[] {
		return tool_names.filter((name) => this.registry.get(name)?.category !== category);
	}

	/* *******************************************************
		Execution
	******************************************************** */

	/**
	 * Execute a tool by name with bucket-based throttle enforcement.
	 * Dispatches to GraphQL query or custom handler based on tool entry config.
	 */
	public async executeTool(name: string, args: Record<string, unknown>, agent?: AiAgentContext): Promise<AiToolResult> {
		const entry = this.registry.get(name);
		if (!entry) {
			return {success: false, error: `Unknown tool: ${name}`};
		}

		const throttle_error = this.checkThrottle(name, entry);
		if (throttle_error) {
			return {success: false, error: throttle_error};
		}

		const guard_error = this.runGuards(entry, name, args);
		if (guard_error) {
			this.logger.warn(`Tool ${name} rejected by guard: ${guard_error}`);
			return {success: false, error: guard_error};
		}

		this.recordCall(name);

		try {
			if (entry.query) {
				return await this.executeGraphQL(name, args, agent);
			} else if (entry.handler) {
				return await entry.handler(args);
			}
			return {success: false, error: `Tool ${name} has no query or handler configured`};
		} catch (error) {
			this.logger.error(`Tool ${name} failed`, error);
			return {success: false, error: String(error?.message ?? error)};
		}
	}

	/* *******************************************************
		Throttling
	******************************************************** */

	/**
	 * Bucket-based throttle check.
	 * Returns an error message if the tool has exceeded its call limit, null otherwise.
	 */
	private checkThrottle(name: string, entry: AiToolEntry): string | null {
		const now = DateTime.utc().toUnixInteger();
		const window_start = now - entry.throttle_window_seconds;
		const timestamps = this.call_log.get(name) ?? [];
		const recent_calls = timestamps.filter((t) => t > window_start);
		if (recent_calls.length >= entry.throttle_max_calls) {
			return `Tool ${name} is throttled: ${entry.throttle_max_calls} calls per ${entry.throttle_window_seconds}s limit reached.`;
		}
		return null;
	}

	/** Record a tool call timestamp and prune old entries */
	private recordCall(name: string): void {
		const now = DateTime.utc().toUnixInteger();
		const timestamps = this.call_log.get(name) ?? [];
		timestamps.push(now);
		/* Keep only the last 100 entries to prevent unbounded growth */
		if (timestamps.length > 100) {
			timestamps.splice(0, timestamps.length - 100);
		}
		this.call_log.set(name, timestamps);
	}

	/* *******************************************************
		Tool Guards
	******************************************************** */

	/**
	 * Run all registered guards against a pending tool call.
	 * Returns the first error message produced, or null if every guard approves.
	 */
	private runGuards(entry: AiToolEntry, tool_name: string, variables: Record<string, unknown>): string | null {
		if (!entry.guards?.length) return null;
		const context: ToolGuardContext = {tool_name, variables};
		for (const guard_name of entry.guards) {
			const guard = this.guards.get(guard_name);
			if (!guard) continue;
			const error = guard(context);
			if (error) return error;
		}
		return null;
	}

	/**
	 * Reject analytics calls that would return an unbounded number of buckets.
	 * The model occasionally requests a fine-grained interval against an open
	 * date_start, which produces tens of thousands of rows and blows the context
	 * window. Returning a teaching error lets the model self-correct on the next turn.
	 */
	private guardAnalyticsBucketBudget({variables}: ToolGuardContext): string | null {
		const interval = variables.interval as string | undefined;
		if (!interval || interval === 'custom') return null;

		const interval_seconds = ToolService.INTERVAL_SECONDS[interval as keyof typeof ToolService.INTERVAL_SECONDS];
		if (!interval_seconds) return null;

		const now = DateTime.utc().toUnixInteger();
		const date_start = (variables.date_start as number | undefined) ?? 0;
		const date_end = (variables.date_end as number | undefined) ?? now;

		if (date_start <= 0) {
			return (
				`interval='${interval}' requires a bounded date_start. ` +
				`For all-time totals or a single aggregated value over the full range, use interval='custom' instead. ` +
				`For a time-series, set date_start to the beginning of the window you care about.`
			);
		}

		const estimated_buckets = Math.ceil((date_end - date_start) / interval_seconds);
		if (estimated_buckets > ToolService.MAX_ANALYTICS_BUCKETS) {
			return (
				`interval='${interval}' over the requested range would return ~${estimated_buckets} buckets ` +
				`(max ${ToolService.MAX_ANALYTICS_BUCKETS}). ` +
				`Use a coarser interval (e.g. 'week'/'month'), narrow date_start, or use interval='custom' for a single aggregate.`
			);
		}

		return null;
	}

	/**
	 * Reject mint metrics calls when the configured mint cannot provide Prometheus metrics.
	 * @returns {string | null} An actionable configuration error, or null when enabled
	 */
	private guardMintMetricsEnabled(): string | null {
		if (this.configService.get<string>('cashu.type') !== MintType.CDK) {
			return 'Mint metrics are unavailable: GET_MINT_METRICS requires MINT_TYPE=cdk.';
		}
		if (!this.configService.get<string>('cashu.metrics_api')) {
			return 'Mint metrics are unavailable: configure MINT_METRICS_API for the CDK mint exporter.';
		}
		return null;
	}

	/**
	 * Reject mint metrics calls that are unbounded, malformed, or likely to overflow the model context.
	 * @param {ToolGuardContext} context - Pending tool call variables
	 * @returns {string | null} A teaching error, or null when the query is within budget
	 */
	private guardMintMetricsQueryBudget({variables}: ToolGuardContext): string | null {
		const date_start = variables.date_start;
		const date_end = variables.date_end ?? DateTime.utc().toUnixInteger();
		const interval = variables.interval;
		const metrics = variables.metrics;

		if (typeof date_start !== 'number' || !Number.isFinite(date_start) || date_start <= 0) {
			return 'GET_MINT_METRICS requires a valid, positive date_start to bound the query.';
		}
		if (typeof date_end !== 'number' || !Number.isFinite(date_end) || date_end <= date_start) {
			return 'GET_MINT_METRICS requires date_end to be later than date_start. Omit date_end to use the current time.';
		}
		if (typeof interval !== 'string' || !['minute', 'hour', 'day'].includes(interval)) {
			return "GET_MINT_METRICS requires interval='minute', 'hour', or 'day'.";
		}
		if (
			!Array.isArray(metrics) ||
			metrics.length === 0 ||
			!metrics.every((metric) => typeof metric === 'string' && metric.length > 0)
		) {
			return 'GET_MINT_METRICS requires at least one explicit metric family name.';
		}

		const interval_seconds = ToolService.INTERVAL_SECONDS[interval as 'minute' | 'hour' | 'day'];
		const bucket_count = Math.ceil((date_end - date_start) / interval_seconds);
		const metric_count = new Set(metrics).size;
		const estimated_points = bucket_count * metric_count;
		if (estimated_points > ToolService.MAX_MINT_METRIC_POINTS) {
			return (
				`The mint metrics query would return at least ~${estimated_points} points before label expansion ` +
				`(max ${ToolService.MAX_MINT_METRIC_POINTS}). Narrow the date range, request fewer metrics, or use a coarser interval.`
			);
		}

		return null;
	}

	/* *******************************************************
		GraphQL Execution
	******************************************************** */

	/**
	 * Execute a pre-parsed GraphQL query against the compiled schema.
	 * Uses the same resolver pipeline as the HTTP API.
	 */
	private async executeGraphQL(name: string, variables: Record<string, unknown>, agent?: AiAgentContext): Promise<AiToolResult> {
		if (!this.schema) {
			this.schema = this.moduleRef.get(GraphQLSchemaHost, {strict: false}).schema;
		}
		const document = this.parsed_queries.get(name)!;
		const user = {
			id: agent?.agent_id ?? 'agent',
			name: agent?.agent_name ?? 'agent',
			role: UserRole.AGENT,
		};
		const result = await execute({
			schema: this.schema,
			document,
			variableValues: variables,
			contextValue: {req: {headers: {}, user, internal: true}},
		});

		if (result.errors?.length) {
			const messages = result.errors.map((e) => e.message).join('; ');
			this.logger.warn(`GraphQL execution error: ${messages}`);
			return {success: false, error: messages};
		}

		return {success: true, data: result.data};
	}
}
