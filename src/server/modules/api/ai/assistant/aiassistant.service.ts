/* Core Dependencies */
import {Injectable, Logger} from '@nestjs/common';
/* Application Dependencies */
import {ErrorService} from '@server/modules/error/error.service';
import {OrchardErrorCode} from '@server/modules/error/error.types';
import {OrchardApiError} from '@server/modules/graphql/classes/orchard-error.class';
/* Native Dependencies */
import {AiAssistant} from '@server/modules/ai/assistant/ai.assistant.enums';
import {AI_ASSISTANTS} from '@server/modules/ai/assistant/ai.assistants';
/* Local Dependencies */
import {OrchardAiAssistant} from './aiassistant.model.js';

@Injectable()
export class AiAssistantService {
	private readonly logger = new Logger(AiAssistantService.name);

	constructor(private errorService: ErrorService) {}

	async getAssistant(tag: string, assistant_name: AiAssistant): Promise<OrchardAiAssistant> {
		try {
			const assistant = AI_ASSISTANTS[assistant_name];
			if (!assistant) throw OrchardErrorCode.AiAssistantNotFoundError;
			return new OrchardAiAssistant(assistant);
		} catch (error) {
			const orchard_error = this.errorService.resolveError(this.logger, error, tag, {
				errord: OrchardErrorCode.AiError,
			});
			throw new OrchardApiError(orchard_error);
		}
	}
}
