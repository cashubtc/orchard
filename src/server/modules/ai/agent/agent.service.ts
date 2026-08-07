/* Core Dependencies */
import {Injectable, Logger, OnModuleInit} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {InjectRepository} from '@nestjs/typeorm';
/* Vendor Dependencies */
import {Repository} from 'typeorm';
import {SchedulerRegistry} from '@nestjs/schedule';
import {CronJob} from 'cron';
import {DateTime} from 'luxon';
/* Application Dependencies */
import {AiService} from '#server/modules/ai/ai.service';
import {AiMessage, AiTool, AiToolCall, AiStreamChunk} from '#server/modules/ai/ai.types';
import {AiMessageRole} from '#server/modules/ai/ai.enums';
import {MintMetricsService} from '#server/modules/cashu/mintmetrics/mintmetrics.service';
import {safeParse} from '#server/modules/utilities/index';
/* Native Dependencies */
import {ToolService} from '#server/modules/ai/tools/tool.service';
import {AiAgentContext} from '#server/modules/ai/tools/tool.types';
/* Local Dependencies */
import {Agent} from './agent.entity.js';
import {AgentRun} from './agent-run.entity.js';
import {AgentToolCategory, AgentToolName, AgentKey, AgentRunStatus} from './agent.enums.js';
import {AGENTS} from './agent.agents.js';

@Injectable()
export class AgentService implements OnModuleInit {
	private readonly logger = new Logger(AgentService.name);

	private static readonly MAX_TOOL_ITERATIONS = 25;
	private static readonly MAX_DELIBERATION_ITERATIONS = 3;
	private static readonly MIN_CRON_INTERVAL_MINUTES = 5;
	private static readonly MAX_QUEUE_DEPTH = 10;

	private static readonly GATHER_PROMPT = [
		'Run your analysis now.',
		'Message tools are not available in this phase — a deliberation step follows where you can notify the operator.',
		'Write a thorough analysis as your final response.',
	].join('\n');

	private static readonly DELIBERATION_PROMPT_DUAL = [
		'Based on your analysis above, decide whether the operator needs to be notified.',
		'Apply the notification criteria defined in your system prompt to make this decision.',
		'Call exactly one tool: SEND_MESSAGE to notify, or SKIP_MESSAGE to stay silent.',
	].join('\n');

	private static readonly DELIBERATION_PROMPT_SEND_ONLY = [
		'Based on your analysis above, compile your findings into a message for the operator.',
		'Call SEND_MESSAGE with a summary of your analysis.',
	].join('\n');

	private execution_queue: Promise<any> = Promise.resolve();
	private queue_depth = 0;
	private readonly pending_agents = new Set<string>();

	constructor(
		@InjectRepository(Agent)
		private agentRepository: Repository<Agent>,
		@InjectRepository(AgentRun)
		private runRepository: Repository<AgentRun>,
		private schedulerRegistry: SchedulerRegistry,
		private aiService: AiService,
		private configService: ConfigService,
		private toolExecutor: ToolService,
		private mintMetricsService: MintMetricsService,
	) {}

	async onModuleInit(): Promise<void> {
		if (process.env.SCHEMA_ONLY) return;
		await this.seedBuiltInAgents();
		await this.registerAllSchedules();
	}

	/* *******************************************************
		Seeding
	******************************************************** */

	/**
	 * Seeds built-in agents from the AGENTS registry if they do not already exist.
	 * Existing records are never overwritten — user customizations are preserved.
	 */
	private async seedBuiltInAgents(): Promise<void> {
		const now = DateTime.utc().toUnixInteger();
		for (const [key, definition] of Object.entries(AGENTS)) {
			const agent_key = key as AgentKey;
			const existing = await this.agentRepository.findOne({where: {agent_key}});
			if (existing) continue;
			const agent = this.agentRepository.create({
				agent_key,
				name: null,
				description: null,
				active: false,
				system_message: null,
				tools: null,
				schedules: JSON.stringify(definition.schedules ?? []),
				last_run_at: null,
				last_run_status: null,
				created_at: now,
				updated_at: now,
			});
			await this.agentRepository.save(agent);
			this.logger.log(`Seeded agent: ${agent_key}`);
		}
	}

	/* *******************************************************
		Scheduling
	******************************************************** */

	/**
	 * Registers cron schedules for all active agents on boot.
	 */
	private async registerAllSchedules(): Promise<void> {
		const agents = await this.agentRepository.find();
		for (const agent of agents) {
			if (!agent.active) continue;
			const schedules: string[] = safeParse(agent.schedules, [], `agent.schedules[${agent.id}]`);
			for (const cron_expression of schedules) {
				this.registerCronJob(agent, cron_expression);
			}
		}
	}

	/**
	 * Validates that a cron expression is syntactically correct and does not fire
	 * more frequently than MIN_CRON_INTERVAL_MINUTES.
	 */
	private validateCronExpression(cron_expression: string, timezone?: string | null): void {
		try {
			const probe = new CronJob(cron_expression, () => {}, null, false, timezone ?? 'UTC');
			const [first, second] = probe.nextDates(2) as unknown as DateTime[];
			const diff_minutes = second.diff(first, 'minutes').minutes;
			if (diff_minutes < AgentService.MIN_CRON_INTERVAL_MINUTES) {
				throw new Error(
					`Cron expression "${cron_expression}" fires every ${diff_minutes} minute(s). Minimum allowed interval is ${AgentService.MIN_CRON_INTERVAL_MINUTES} minutes.`,
				);
			}
		} catch (err: any) {
			if (err.message?.includes('Minimum allowed interval')) throw err;
			throw new Error(`Invalid cron expression: "${cron_expression}"`);
		}
	}

	/**
	 * Registers a single cron job for an agent + schedule expression.
	 * Job name format: agent:{agent.id}:{cron_expression}
	 */
	private registerCronJob(agent: Agent, cron_expression: string): void {
		const timezone = agent.schedule_tz ?? 'UTC';
		this.validateCronExpression(cron_expression, timezone);
		const job_name = `agent:${agent.id}:${cron_expression}`;
		if (this.schedulerRegistry.doesExist('cron', job_name)) return;
		const job = new CronJob(
			cron_expression,
			async () => {
				await this.enqueueAgent(agent.id, cron_expression);
			},
			null,
			false,
			timezone,
		);
		this.schedulerRegistry.addCronJob(job_name, job);
		job.start();
		this.logger.log(`Registered cron: ${job_name} (tz: ${timezone})`);
	}

	/**
	 * Enqueues a scheduled agent run for sequential execution.
	 * Deduplicates by agent_id and enforces a max queue depth to prevent unbounded growth.
	 */
	private async enqueueAgent(agent_id: string, schedule_trigger: string): Promise<void> {
		if (this.pending_agents.has(agent_id)) {
			this.logger.warn(`Agent ${agent_id} already queued, skipping duplicate`);
			return;
		}
		if (this.queue_depth >= AgentService.MAX_QUEUE_DEPTH) {
			this.logger.warn(`Execution queue full (${this.queue_depth}), dropping scheduled run for ${agent_id}`);
			return;
		}
		this.pending_agents.add(agent_id);
		this.queue_depth++;
		const task = () =>
			this.executeAgent(agent_id, schedule_trigger).finally(() => {
				this.pending_agents.delete(agent_id);
				this.queue_depth--;
			});
		const result = this.execution_queue.then(task, task);
		this.execution_queue = result.catch(() => {});
		await result;
	}

	/**
	 * Removes all cron jobs registered for a specific agent.
	 */
	private removeCronJobsForAgent(agent_id: string): void {
		const all_jobs = this.schedulerRegistry.getCronJobs();
		const prefix = `agent:${agent_id}:`;
		all_jobs.forEach((_job, name) => {
			if (name.startsWith(prefix)) {
				this.schedulerRegistry.deleteCronJob(name);
				this.logger.log(`Removed cron: ${name}`);
			}
		});
	}

	/**
	 * Re-registers cron jobs for an agent after update.
	 */
	public async syncAgentSchedules(agent: Agent): Promise<void> {
		this.removeCronJobsForAgent(agent.id);
		if (!agent.active) return;
		const schedules: string[] = safeParse(agent.schedules, [], `agent.schedules[${agent.id}]`);
		for (const cron_expression of schedules) {
			this.registerCronJob(agent, cron_expression);
		}
	}

	/* *******************************************************
		Execution
	******************************************************** */

	/**
	 * Creates a run record, executes the agent via LLM with tool calling, and updates run status.
	 */
	public async executeAgent(agent_id: string, schedule_trigger: string | null = null): Promise<AgentRun> {
		const now = DateTime.utc().toUnixInteger();
		const agent = await this.agentRepository.findOne({where: {id: agent_id}});
		if (!agent) throw new Error(`Agent not found: ${agent_id}`);

		const run = this.runRepository.create({
			agent,
			status: AgentRunStatus.RUNNING,
			schedule_trigger,
			started_at: now,
			completed_at: null,
			result: null,
			error: null,
			tokens_used: null,
		});
		const saved_run = await this.runRepository.save(run);

		await this.agentRepository.update(agent_id, {
			last_run_at: now,
			last_run_status: AgentRunStatus.RUNNING,
			updated_at: now,
		});

		try {
			const {result, tokens_used, notified} = await this.runAgentLoop(agent);
			const completed_at = DateTime.utc().toUnixInteger();
			await this.runRepository.update(saved_run.id, {
				status: AgentRunStatus.SUCCESS,
				completed_at,
				result,
				tokens_used,
				notified,
			});
			await this.agentRepository.update(agent_id, {
				last_run_status: AgentRunStatus.SUCCESS,
				updated_at: completed_at,
			});
			this.logger.log(`Agent ${this.resolveName(agent)} completed successfully`);
			return {...saved_run, status: AgentRunStatus.SUCCESS, completed_at, result, tokens_used, notified};
		} catch (error) {
			const completed_at = DateTime.utc().toUnixInteger();
			await this.runRepository.update(saved_run.id, {
				status: AgentRunStatus.ERROR,
				completed_at,
				error: String(error?.message ?? error),
			});
			await this.agentRepository.update(agent_id, {
				last_run_status: AgentRunStatus.ERROR,
				updated_at: completed_at,
			});
			this.logger.error(`Agent ${this.resolveName(agent)} failed`, error);
			throw error;
		}
	}

	/**
	 * Runs the LLM tool-call loop for an agent using a two-phase architecture:
	 * 1. Gather — data collection with all tools except message tools
	 * 2. Deliberation — notification decision with only message tools
	 * The deliberation phase is skipped when the agent has no message tools.
	 */
	private async runAgentLoop(agent: Agent): Promise<{result: string; tokens_used: number; notified: boolean}> {
		const tool_names = this.resolveToolNames(agent);
		const message_tools = this.toolExecutor.getToolNamesByCategory(tool_names, AgentToolCategory.MESSAGE);
		const primary_tools = this.toolExecutor.getToolNamesExcludingCategory(tool_names, AgentToolCategory.MESSAGE);
		const has_deliberation = message_tools.length > 0;

		const resolved_name = this.resolveName(agent);
		const system_message: AiMessage = {role: AiMessageRole.SYSTEM, content: this.buildSystemMessage(agent)};
		const user_prompt = has_deliberation ? AgentService.GATHER_PROMPT : 'Run your analysis now.';
		const messages: AiMessage[] = [system_message, {role: AiMessageRole.USER, content: user_prompt}];
		const agent_context: AiAgentContext = {agent_id: agent.id, agent_name: resolved_name};

		if (!agent.model) throw new Error(`Agent "${resolved_name}" has no model configured`);

		/* Phase 1: Gather */
		const gather_result = await this.runToolLoop({model: agent.model, messages, tool_names: primary_tools, agent_context});
		let total_tokens = gather_result.tokens_used;
		let result = gather_result.result;
		let notified = false;

		/* Phase 2: Deliberation */
		if (has_deliberation) {
			const has_skip = message_tools.includes(AgentToolName.SKIP_MESSAGE);
			const deliberation_prompt = has_skip ? AgentService.DELIBERATION_PROMPT_DUAL : AgentService.DELIBERATION_PROMPT_SEND_ONLY;

			gather_result.messages.push({role: AiMessageRole.USER, content: deliberation_prompt});

			const deliberation_result = await this.runToolLoop({
				model: agent.model,
				messages: gather_result.messages,
				tool_names: message_tools,
				agent_context,
				max_iterations: AgentService.MAX_DELIBERATION_ITERATIONS,
			});

			total_tokens += deliberation_result.tokens_used;

			/* Extract result from the deliberation tool call */
			const {deliberation_result: extracted_result, was_notified} = this.extractDeliberationResult(deliberation_result.messages);
			result = extracted_result ?? deliberation_result.result;
			notified = was_notified;
		}

		return {result, tokens_used: total_tokens, notified};
	}

	/**
	 * Reusable LLM tool-call loop. Resolves the model, builds tool schemas, and iterates
	 * until the LLM returns content or the iteration cap is hit.
	 * Used by both scheduled agent runs and conversational flows.
	 */
	public async runToolLoop(options: {
		model: string;
		messages: AiMessage[];
		tool_names: string[];
		agent_context: AiAgentContext;
		signal?: AbortSignal;
		max_iterations?: number;
	}): Promise<{result: string; tokens_used: number; messages: AiMessage[]}> {
		const {model, messages, tool_names, agent_context, signal} = options;
		const max_iterations = options.max_iterations ?? AgentService.MAX_TOOL_ITERATIONS;
		const tool_schemas = this.toolExecutor.getToolSchemas(tool_names);
		let total_tokens = 0;

		for (let iteration = 0; iteration < max_iterations; iteration++) {
			if (signal?.aborted) {
				return {result: '', tokens_used: total_tokens, messages};
			}

			const response = await this.collectStreamResponse(model, messages, tool_schemas, signal);
			total_tokens += (response.usage?.prompt_tokens ?? 0) + (response.usage?.completion_tokens ?? 0);

			if (response.message.tool_calls?.length) {
				messages.push(response.message);
				for (const tool_call of response.message.tool_calls) {
					if (signal?.aborted) {
						return {result: '', tokens_used: total_tokens, messages};
					}
					const tool_result = await this.toolExecutor.executeTool(
						tool_call.function.name,
						tool_call.function.arguments,
						agent_context,
					);
					messages.push({role: AiMessageRole.TOOL, content: JSON.stringify(tool_result), tool_call_id: tool_call.id});
				}
			} else {
				messages.push(response.message);
				return {result: response.message.content, tokens_used: total_tokens, messages};
			}
		}

		return {result: 'Agent reached maximum tool iterations without producing a final response.', tokens_used: total_tokens, messages};
	}

	/**
	 * Collects a full streamed response into a single chunk with accumulated content and tool calls.
	 * Accumulates content and tool_calls from intermediate chunks so the result is vendor-agnostic.
	 */
	private async collectStreamResponse(
		model: string,
		messages: AiMessage[],
		tools: AiTool[],
		signal?: AbortSignal,
	): Promise<AiStreamChunk> {
		let final_chunk: AiStreamChunk | null = null;
		let accumulated_content = '';
		const accumulated_tool_calls: AiToolCall[] = [];

		for await (const chunk of this.aiService.streamAgent(model, messages, tools, signal)) {
			if (chunk.done) {
				final_chunk = chunk;
			} else {
				accumulated_content += chunk.message.content ?? '';
				if (chunk.message.tool_calls?.length) {
					accumulated_tool_calls.push(...chunk.message.tool_calls);
				}
			}
		}

		if (!final_chunk) {
			throw new Error('Stream ended without a done chunk');
		}

		/* Prefer accumulated stream content over the done chunk's content */
		final_chunk.message.content = accumulated_content || final_chunk.message.content;

		/* Merge tool calls: use accumulated if present, fall back to done chunk's */
		if (accumulated_tool_calls.length) {
			final_chunk.message.tool_calls = accumulated_tool_calls;
		}

		return final_chunk;
	}

	/**
	 * Extracts the run result and notification status from the deliberation phase messages.
	 * For SEND_MESSAGE: the message body becomes the result, notified is true if delivered.
	 * For SKIP_MESSAGE: the skip reason becomes the result, notified is false.
	 * Falls back to null if no deliberation tool call is found.
	 */
	private extractDeliberationResult(messages: AiMessage[]): {deliberation_result: string | null; was_notified: boolean} {
		for (let i = messages.length - 1; i >= 0; i--) {
			const msg = messages[i];
			if (msg.role !== AiMessageRole.TOOL || !msg.tool_call_id) continue;

			/* Find the matching assistant tool_call */
			const tool_call = messages.flatMap((m) => m.tool_calls ?? []).find((tc) => tc.id === msg.tool_call_id);
			const tool_name = tool_call?.function.name;

			if (tool_name === AgentToolName.SEND_MESSAGE) {
				try {
					const parsed = JSON.parse(msg.content);
					const delivered = parsed?.success === true && parsed?.data?.delivered === true;
					const args = tool_call?.function.arguments ?? {};
					const body = `[${args.severity ?? 'info'}] ${args.title ?? ''}\n${args.body ?? ''}`.trim();
					return {deliberation_result: body, was_notified: delivered};
				} catch {
					return {deliberation_result: null, was_notified: false};
				}
			}

			if (tool_name === AgentToolName.SKIP_MESSAGE) {
				try {
					const parsed = JSON.parse(msg.content);
					const reason = parsed?.data?.reason ?? 'No reason provided';
					return {deliberation_result: reason, was_notified: false};
				} catch {
					return {deliberation_result: null, was_notified: false};
				}
			}
		}

		return {deliberation_result: null, was_notified: false};
	}

	/* *******************************************************
		Agent Resolution Helpers
	******************************************************** */

	/** Resolve the effective name for an agent, falling back to built-in default */
	public resolveName(agent: Agent): string {
		const built_in = agent.agent_key ? AGENTS[agent.agent_key]?.name : undefined;
		return agent.name ?? built_in ?? 'Unnamed Agent';
	}

	/** Resolve the effective description for an agent, falling back to built-in default */
	public resolveDescription(agent: Agent): string {
		const built_in = agent.agent_key ? AGENTS[agent.agent_key]?.description : undefined;
		return agent.description ?? built_in ?? '';
	}

	/** Resolve the effective tool names for an agent, falling back to built-in defaults */
	public resolveToolNames(agent: Agent): string[] {
		const built_in_tools = agent.agent_key ? AGENTS[agent.agent_key]?.tools : undefined;
		return agent.tools ? safeParse(agent.tools, built_in_tools ?? [], `agent.tools[${agent.id}]`) : (built_in_tools ?? []);
	}

	/** Build a system message from agent config + runtime context */
	public buildSystemMessage(agent: Agent): string {
		const built_in = agent.agent_key ? AGENTS[agent.agent_key]?.system_message : undefined;
		const base_message = agent.system_message ?? built_in ?? '';
		return `${base_message}\n\n${this.buildRuntimeContext(agent)}`;
	}

	/* *******************************************************
		Runtime Context
	******************************************************** */

	/** Builds a runtime context string to append to agent system messages */
	public buildRuntimeContext(agent: Agent): string {
		const timezone = agent.schedule_tz ?? 'UTC';
		const now = DateTime.utc().setZone(timezone);
		const version = this.configService.get<string>('mode.version');

		const services: string[] = [];
		const bitcoin = this.configService.get<string>('bitcoin.type');
		const lightning = this.configService.get<string>('lightning.type');
		const mint = this.configService.get<string>('cashu.type');
		const mint_metrics_enabled = this.mintMetricsService.isEnabled();
		if (bitcoin) services.push(`bitcoin (${bitcoin})`);
		if (lightning) services.push(`lightning (${lightning})`);
		if (mint) services.push(`mint (${mint})`);
		const schedules: string[] = safeParse(agent.schedules, [], `agent.schedules[${agent.id}]`);
		const cadence = schedules.length ? schedules.map((s) => this.describeCadence(s, timezone)).join('; ') : 'on-demand only';

		return [
			'[Runtime Context]',
			`Agent ID: ${agent.id}`,
			`Current time: ${now.toISO()} (unix: ${now.toUnixInteger()})`,
			`Timezone: ${timezone}`,
			`App version: ${version}`,
			`Configured services: ${services.length ? services.join(', ') : 'none'}`,
			`Mint metrics: ${mint_metrics_enabled ? 'enabled' : 'disabled'}`,
			`Schedule: ${cadence}`,
		].join('\n');
	}

	/**
	 * Converts a cron expression into a cadence description the agent can reason about.
	 * Focuses on the interval between runs so the agent knows what time window to analyze.
	 */
	private describeCadence(cron: string, timezone: string): string {
		const parts = cron.trim().split(/\s+/);
		if (parts.length !== 5) return `custom (${cron})`;
		const [minute, hour, day_of_month, _month, day_of_week] = parts;

		/* Sub-hourly */
		if (hour === '*' && minute.startsWith('*/')) {
			const mins = parseInt(minute.slice(2), 10);
			return `every ${mins} minutes — focus on the last ${mins} minutes of activity`;
		}

		/* Hourly */
		if (hour === '*') {
			return 'every hour — focus on the last hour of activity';
		}

		/* Every N hours */
		if (hour.startsWith('*/')) {
			const hrs = parseInt(hour.slice(2), 10);
			return `every ${hrs} hours — focus on the last ${hrs} hours of activity`;
		}

		/* Monthly */
		if (day_of_month !== '*' && day_of_week === '*') {
			return `monthly on day ${day_of_month} at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')} ${timezone} — focus on the last 30 days of activity`;
		}

		/* Weekly */
		if (day_of_month === '*' && day_of_week !== '*') {
			return 'weekly — focus on the last 7 days of activity';
		}

		/* Daily */
		if (day_of_month === '*' && day_of_week === '*') {
			return `daily at ${hour.padStart(2, '0')}:${minute.padStart(2, '0')} ${timezone} — focus on the last 24 hours of activity`;
		}

		return `custom (${cron})`;
	}

	/* *******************************************************
		Data Access
	******************************************************** */

	/** Find all agents */
	public async getAgents(): Promise<Agent[]> {
		return this.agentRepository.find({order: {created_at: 'ASC'}});
	}

	/** Find a single agent by ID */
	public async getAgent(id: string): Promise<Agent | null> {
		return this.agentRepository.findOne({where: {id}});
	}

	/** Find a single agent by its built-in key */
	public async getAgentByKey(key: AgentKey): Promise<Agent | null> {
		return this.agentRepository.findOne({where: {agent_key: key}});
	}

	/** Get runs for an agent, most recent first, with pagination and optional notified filter */
	public async getAgentRuns(options: {agent_id: string; page?: number; page_size?: number; notified?: boolean}): Promise<AgentRun[]> {
		const {agent_id, page = 0, page_size = 20, notified} = options;
		const where: Record<string, any> = {agent: {id: agent_id}};
		if (notified !== undefined) where.notified = notified;
		return this.runRepository.find({
			where,
			order: {started_at: 'DESC'},
			skip: page * page_size,
			take: page_size,
		});
	}

	/** Creates a new custom agent (no agent_key) and syncs its cron schedules */
	public async createAgent(fields: {
		name: string;
		description?: string;
		active?: boolean;
		model?: string;
		system_message?: string;
		tools?: string[];
		schedules?: string[];
		schedule_tz?: string;
	}): Promise<Agent> {
		const now = DateTime.utc().toUnixInteger();
		if (fields.schedules) {
			fields.schedules.forEach((expr) => this.validateCronExpression(expr, fields.schedule_tz));
		}
		const agent = this.agentRepository.create({
			agent_key: null,
			name: fields.name,
			description: fields.description ?? null,
			active: fields.active ?? false,
			model: fields.model ?? null,
			system_message: fields.system_message ?? null,
			tools: fields.tools ? JSON.stringify(fields.tools) : null,
			schedules: JSON.stringify(fields.schedules ?? []),
			schedule_tz: fields.schedule_tz ?? null,
			last_run_at: null,
			last_run_status: null,
			created_at: now,
			updated_at: now,
		});
		const saved = await this.agentRepository.save(agent);
		await this.syncAgentSchedules(saved);
		return saved;
	}

	/** Delete a custom agent (agent_key must be null). Cleans up cron jobs before removal. */
	public async deleteAgent(id: string): Promise<void> {
		const agent = await this.agentRepository.findOne({where: {id}});
		if (!agent) throw new Error(`Agent not found: ${id}`);
		if (agent.agent_key !== null) throw new Error(`Cannot delete built-in agent: ${agent.agent_key}`);
		this.removeCronJobsForAgent(agent.id);
		this.pending_agents.delete(agent.id);
		await this.agentRepository.remove(agent);
	}

	/** Update an agent and re-sync its cron schedules */
	public async updateAgent(
		id: string,
		updates: Partial<
			Pick<Agent, 'name' | 'description' | 'active' | 'model' | 'system_message' | 'tools' | 'schedules' | 'schedule_tz'>
		>,
	): Promise<Agent> {
		const agent = await this.agentRepository.findOne({where: {id}});
		if (!agent) throw new Error(`Agent not found: ${id}`);
		if (updates.schedules) {
			const timezone = updates.schedule_tz ?? agent.schedule_tz;
			const expressions: string[] = JSON.parse(updates.schedules);
			expressions.forEach((expr) => this.validateCronExpression(expr, timezone));
		}
		const now = DateTime.utc().toUnixInteger();
		Object.assign(agent, updates, {updated_at: now});
		const saved = await this.agentRepository.save(agent);
		await this.syncAgentSchedules(saved);
		return saved;
	}

	/* *******************************************************
		Retention
	******************************************************** */

	/**
	 * Deletes runs older than the most recent 100 for each agent.
	 * Called by TaskService on a schedule.
	 */
	public async cleanupOldRuns(): Promise<void> {
		const agents = await this.agentRepository.find();
		for (const agent of agents) {
			const boundary_runs = await this.runRepository.find({
				where: {agent: {id: agent.id}},
				order: {started_at: 'DESC'},
				skip: 100,
				take: 1,
			});
			if (boundary_runs.length === 0) continue;
			const cutoff = boundary_runs[0].started_at;
			await this.runRepository
				.createQueryBuilder()
				.delete()
				.where('agent_id = :agent_id AND started_at <= :cutoff', {agent_id: agent.id, cutoff})
				.execute();
			this.logger.log(`Cleaned up old runs for agent ${this.resolveName(agent)}`);
		}
	}
}
