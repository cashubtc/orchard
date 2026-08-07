/* Core Dependencies */
import {Injectable} from '@nestjs/common';
/* Application Dependencies */
import {ToolService} from '#server/modules/ai/tools/tool.service';
/* Local Dependencies */
import {OrchardAgentTool} from './aitools.model.js';

@Injectable()
export class AiToolsService {
	constructor(private readonly toolService: ToolService) {}

	/** Returns metadata for all registered agent tools */
	getTools(): OrchardAgentTool[] {
		return this.toolService.getRegisteredToolEntries().map((entry) => new OrchardAgentTool(entry));
	}
}
