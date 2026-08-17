/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {ErrorService} from '#server/modules/error/error.service';
import {OrchardErrorCode} from '#server/modules/error/error.types';
import {OrchardApiError} from '#server/modules/graphql/classes/orchard-error.class';
/* Native Dependencies */
import {AgentService} from '#server/modules/ai/agent/agent.service';
import {AgentKey} from '#server/modules/ai/agent/agent.enums';
import {AGENTS} from '#server/modules/ai/agent/agent.agents';
/* Local Dependencies */
import {OrchardAgent, OrchardAgentDefault, OrchardAgentRun} from './aiagent.model.js';

@Injectable()
export class AiAgentService {
	private readonly logger = new Logger(AiAgentService.name);

	constructor(
		private agentService: AgentService,
		private errorService: ErrorService,
	) {}

	/** Retrieves default configuration for an agent key */
	getAgentDefaults(agent_key: AgentKey): OrchardAgentDefault {
		const agent = AGENTS[agent_key];
		return new OrchardAgentDefault(agent_key, agent.system_message, agent.tools);
	}

	/** Retrieves all agents */
	async getAgents(tag: string): Promise<OrchardAgent[]> {
		try {
			const agents = await this.agentService.getAgents();
			return agents.map((agent) => new OrchardAgent(agent));
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.AgentError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	/** Retrieves a single agent by ID */
	async getAgent(tag: string, id: string): Promise<OrchardAgent> {
		try {
			const agent = await this.agentService.getAgent(id);
			if (!agent) throw OrchardErrorCode.AgentNotFoundError;
			return new OrchardAgent(agent);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.AgentError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	/** Retrieves runs for an agent with pagination and optional notified filter */
	async getAgentRuns(
		tag: string,
		options: {agent_id: string; page?: number; page_size?: number; notified?: boolean},
	): Promise<OrchardAgentRun[]> {
		try {
			const runs = await this.agentService.getAgentRuns(options);
			return runs.map((run) => new OrchardAgentRun(run));
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.AgentError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	/** Creates a new custom agent */
	async createAgent(
		tag: string,
		fields: {
			name: string;
			description?: string;
			active?: boolean;
			model?: string;
			system_message?: string;
			tools?: string[];
			schedules?: string[];
			schedule_tz?: string;
		},
	): Promise<OrchardAgent> {
		try {
			const agent = await this.agentService.createAgent(fields);
			return new OrchardAgent(agent);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.AgentError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	/** Updates an agent's configuration */
	async updateAgent(
		tag: string,
		id: string,
		updates: {
			name?: string;
			description?: string;
			active?: boolean;
			model?: string;
			system_message?: string;
			tools?: string[];
			schedules?: string[];
			schedule_tz?: string;
		},
	): Promise<OrchardAgent> {
		try {
			const serialized: Record<string, any> = {};
			if (updates.name !== undefined) serialized.name = updates.name;
			if (updates.description !== undefined) serialized.description = updates.description;
			if (updates.active !== undefined) serialized.active = updates.active;
			if (updates.model !== undefined) serialized.model = updates.model;
			if (updates.system_message !== undefined) serialized.system_message = updates.system_message;
			if (updates.tools !== undefined) serialized.tools = JSON.stringify(updates.tools);
			if (updates.schedules !== undefined) serialized.schedules = JSON.stringify(updates.schedules);
			if (updates.schedule_tz !== undefined) serialized.schedule_tz = updates.schedule_tz;
			const agent = await this.agentService.updateAgent(id, serialized);
			return new OrchardAgent(agent);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.AgentError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	/** Deletes a custom agent */
	async deleteAgent(tag: string, id: string): Promise<void> {
		try {
			await this.agentService.deleteAgent(id);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.AgentDeleteError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}

	/** Manually triggers an agent execution */
	async executeAgent(tag: string, id: string): Promise<OrchardAgentRun> {
		try {
			const run = await this.agentService.executeAgent(id);
			return new OrchardAgentRun(run);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.AgentError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}
}
