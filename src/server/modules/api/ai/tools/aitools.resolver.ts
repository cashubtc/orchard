/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query} from '@nestjs/graphql';
/* Local Dependencies */
import {AiToolsService} from './aitools.service.js';
import {OrchardAgentTool} from './aitools.model.js';

@Resolver(() => [OrchardAgentTool])
export class AiToolsResolver {
	private readonly logger = new Logger(AiToolsResolver.name);

	constructor(private aiToolsService: AiToolsService) {}

	/* *******************************************************
		Queries
	******************************************************** */

	@Query(() => [OrchardAgentTool], {description: 'Get all available AI agent tools'})
	ai_agent_tools(): OrchardAgentTool[] {
		const tag = 'GET { ai_agent_tools }';
		this.logger.debug(tag);
		return this.aiToolsService.getTools();
	}
}
