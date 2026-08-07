/* Core Dependencies */
import {Logger} from '@nestjs/common';
import {Resolver, Query} from '@nestjs/graphql';
/* Internal Dependencies */
import {AiModelService} from './aimodel.service.js';
import {OrchardAiModel} from './aimodel.model.js';

@Resolver(() => [OrchardAiModel])
export class AiModelResolver {
	private readonly logger = new Logger(AiModelResolver.name);

	constructor(private aiModelService: AiModelService) {}

	@Query(() => [OrchardAiModel], {description: 'Get all available AI models'})
	async ai_models(): Promise<OrchardAiModel[]> {
		const tag = 'GET { ai_models }';
		this.logger.debug(tag);
		return await this.aiModelService.getModels(tag);
	}
}
