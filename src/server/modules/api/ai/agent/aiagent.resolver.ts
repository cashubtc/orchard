/* Core Dependencies */
import {Logger, UseInterceptors} from '@nestjs/common';
import {Resolver, Query, Mutation, Args, Int} from '@nestjs/graphql';
/* Vendor Dependencies */
import {Throttle, minutes} from '@nestjs/throttler';
/* Application Dependencies */
import {Roles} from '#server/modules/auth/decorators/auth.decorator';
import {UserRole} from '#server/modules/user/user.enums';
import {LogEvent} from '#server/modules/event/event.decorator';
import {EventLogType} from '#server/modules/event/event.enums';
import {AgentKey} from '#server/modules/ai/agent/agent.enums';
import {Timezone} from '#server/modules/graphql/scalars/timezone.scalar';
/* Local Dependencies */
import {AiAgentService} from './aiagent.service.js';
import {AiAgentInterceptor} from './aiagent.interceptor.js';
import {OrchardAgent, OrchardAgentDefault, OrchardAgentRun} from './aiagent.model.js';

@Resolver(() => [OrchardAgent])
export class AiAgentResolver {
	private readonly logger = new Logger(AiAgentResolver.name);

	constructor(private aiAgentService: AiAgentService) {}

	/* *******************************************************
		Queries
	******************************************************** */

	@Query(() => OrchardAgentDefault, {description: 'Get default configuration for an AI agent'})
	ai_agent_defaults(
		@Args('agent_key', {type: () => AgentKey, description: 'Agent key to get defaults for'}) agent_key: AgentKey,
	): OrchardAgentDefault {
		const tag = 'GET { ai_agent_defaults }';
		this.logger.debug(tag);
		return this.aiAgentService.getAgentDefaults(agent_key);
	}

	@Query(() => [OrchardAgent], {description: 'Get all AI agents'})
	async ai_agents(): Promise<OrchardAgent[]> {
		const tag = 'GET { ai_agents }';
		this.logger.debug(tag);
		return await this.aiAgentService.getAgents(tag);
	}

	@Query(() => OrchardAgent, {description: 'Get an AI agent by ID'})
	async ai_agent(@Args('id', {description: 'Agent identifier'}) id: string): Promise<OrchardAgent> {
		const tag = 'GET { ai_agent }';
		this.logger.debug(tag);
		return await this.aiAgentService.getAgent(tag, id);
	}

	@Query(() => [OrchardAgentRun], {description: 'Get execution runs for an AI agent'})
	async ai_agent_runs(
		@Args('agent_id', {description: 'Agent identifier to filter runs'}) agent_id: string,
		@Args('page', {type: () => Int, nullable: true, defaultValue: 0, description: 'Page number for pagination'}) page: number,
		@Args('page_size', {type: () => Int, nullable: true, defaultValue: 10, description: 'Number of runs per page'}) page_size: number,
		@Args('notified', {nullable: true, description: 'Filter by notification status'}) notified?: boolean,
	): Promise<OrchardAgentRun[]> {
		const tag = 'GET { ai_agent_runs }';
		this.logger.debug(tag);
		return await this.aiAgentService.getAgentRuns(tag, {agent_id, page, page_size, notified});
	}

	/* *******************************************************
		Mutations
	******************************************************** */

	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@UseInterceptors(AiAgentInterceptor)
	@LogEvent({type: EventLogType.CREATE, field: 'agent'})
	@Mutation(() => OrchardAgent, {description: 'Create a new custom AI agent'})
	async ai_agent_create(
		@Args('name', {description: 'Agent name'}) name: string,
		@Args('description', {nullable: true, description: 'Agent description'}) description: string,
		@Args('active', {nullable: true, description: 'Whether the agent should be active'}) active: boolean,
		@Args('model', {nullable: true, description: 'LLM model identifier'}) model: string,
		@Args('system_message', {nullable: true, description: 'System message for the agent'}) system_message: string,
		@Args('tools', {type: () => [String], nullable: true, description: 'List of tool identifiers to assign'}) tools: string[],
		@Args('schedules', {type: () => [String], nullable: true, description: 'Cron schedules for automatic execution'})
		schedules: string[],
		@Args('schedule_tz', {type: () => Timezone, nullable: true, description: 'IANA timezone for schedule evaluation'})
		schedule_tz: string,
	): Promise<OrchardAgent> {
		const tag = 'MUTATION { ai_agent_create }';
		this.logger.debug(tag);
		return await this.aiAgentService.createAgent(tag, {
			name,
			description,
			active,
			model,
			system_message,
			tools,
			schedules,
			schedule_tz,
		});
	}

	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@UseInterceptors(AiAgentInterceptor)
	@LogEvent({type: EventLogType.UPDATE, field: 'agent'})
	@Mutation(() => OrchardAgent, {description: 'Update an AI agent configuration'})
	async ai_agent_update(
		@Args('id', {description: 'Agent identifier'}) id: string,
		@Args('name', {nullable: true, description: 'New agent name'}) name: string,
		@Args('description', {nullable: true, description: 'New agent description'}) description: string,
		@Args('active', {nullable: true, description: 'Whether the agent should be active'}) active: boolean,
		@Args('model', {nullable: true, description: 'LLM model identifier'}) model: string,
		@Args('system_message', {nullable: true, description: 'New system message for the agent'}) system_message: string,
		@Args('tools', {type: () => [String], nullable: true, description: 'List of tool identifiers to assign'}) tools: string[],
		@Args('schedules', {type: () => [String], nullable: true, description: 'Cron schedules for automatic execution'})
		schedules: string[],
		@Args('schedule_tz', {type: () => Timezone, nullable: true, description: 'IANA timezone for schedule evaluation'})
		schedule_tz: string,
	): Promise<OrchardAgent> {
		const tag = 'MUTATION { ai_agent_update }';
		this.logger.debug(tag);
		return await this.aiAgentService.updateAgent(tag, id, {
			name,
			description,
			active,
			model,
			system_message,
			tools,
			schedules,
			schedule_tz,
		});
	}

	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@Throttle({default: {limit: 3, ttl: minutes(1)}})
	@Mutation(() => OrchardAgentRun, {description: 'Execute an AI agent immediately'})
	async ai_agent_execute(@Args('id', {description: 'Agent identifier'}) id: string): Promise<OrchardAgentRun> {
		const tag = 'MUTATION { ai_agent_execute }';
		this.logger.debug(tag);
		return await this.aiAgentService.executeAgent(tag, id);
	}

	@Roles(UserRole.ADMIN, UserRole.MANAGER)
	@UseInterceptors(AiAgentInterceptor)
	@LogEvent({type: EventLogType.DELETE, field: 'agent'})
	@Mutation(() => Boolean, {description: 'Delete a custom AI agent'})
	async ai_agent_delete(@Args('id', {description: 'Agent identifier'}) id: string): Promise<boolean> {
		const tag = 'MUTATION { ai_agent_delete }';
		this.logger.debug(tag);
		await this.aiAgentService.deleteAgent(tag, id);
		return true;
	}
}
