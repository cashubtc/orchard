/* Core Dependencies */
import {Field, Int, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import type {AiToolEntry} from '#server/modules/ai/tools/tool.types';

@ObjectType({description: 'AI agent tool metadata'})
export class OrchardAgentTool {
	@Field({description: 'Tool function name identifier'})
	name: string;

	@Field({description: 'Short human-readable title for UI display'})
	title: string;

	@Field({description: 'Human-readable description of what the tool does'})
	description: string;

	@Field({description: 'Tool category grouping'})
	category: string;

	@Field({description: 'Tool role: read (data collection) or write (action)'})
	role: string;

	@Field(() => Int, {description: 'Maximum number of calls allowed within the throttle window'})
	throttle_max_calls: number;

	@Field(() => Int, {description: 'Throttle window duration in seconds'})
	throttle_window_seconds: number;

	constructor(entry: AiToolEntry) {
		this.name = entry.tool.function.name;
		this.title = entry.title;
		this.description = entry.description;
		this.category = entry.category;
		this.role = entry.role;
		this.throttle_max_calls = entry.throttle_max_calls;
		this.throttle_window_seconds = entry.throttle_window_seconds;
	}
}
