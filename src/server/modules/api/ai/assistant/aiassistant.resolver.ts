/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query, Args} from '@nestjs/graphql';
/* Native Dependencies */
import {AiAssistant} from '#server/modules/ai/assistant/ai.assistant.enums';
/* Internal Dependencies */
import {AiAssistantService} from './aiassistant.service.js';
import {OrchardAiAssistant} from './aiassistant.model.js';

@Resolver(() => [OrchardAiAssistant])
export class AiAssistantResolver {
	private readonly logger = new Logger(AiAssistantResolver.name);

	constructor(private aiAssistantService: AiAssistantService) {}

	@Query(() => OrchardAiAssistant, {description: 'Get an AI assistant by type'})
	async ai_assistant(
		@Args('assistant', {type: () => AiAssistant, description: 'Assistant type to retrieve'}) assistant: AiAssistant,
	): Promise<OrchardAiAssistant> {
		const tag = 'GET { ai_assistant }';
		this.logger.debug(tag);
		return await this.aiAssistantService.getAssistant(tag, assistant);
	}
}
