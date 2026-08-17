/* Core Dependencies */
import {Field, Int, ObjectType} from '@nestjs/graphql';
/* Application Dependencies */
import type {AiToolCall, AiMessage, AiStreamChunk, AiStreamUsage} from '#server/modules/ai/ai.types';
import {AiMessageRole} from '#server/modules/ai/ai.enums';
import {AssistantToolName} from '#server/modules/ai/assistant/ai.assistant.enums';

@ObjectType({description: 'AI chat tool function call'})
export class OrchardAiChatFunction {
	@Field(() => AssistantToolName, {description: 'Name of the called function'})
	name: string;

	@Field({description: 'JSON-encoded function arguments'})
	arguments: string;

	constructor(funct: AiToolCall['function']) {
		this.name = funct.name;
		this.arguments = JSON.stringify(funct.arguments);
	}
}

@ObjectType({description: 'AI chat tool call'})
export class OrchardAiChatToolCall {
	@Field(() => OrchardAiChatFunction, {description: 'Function invocation details'})
	function: OrchardAiChatFunction;

	constructor(tool_call: AiToolCall) {
		this.function = new OrchardAiChatFunction(tool_call.function);
	}
}

@ObjectType({description: 'AI chat message'})
export class OrchardAiChatMessage {
	@Field(() => AiMessageRole, {description: 'Role of the message sender'})
	role: AiMessageRole;

	@Field({description: 'Message text content'})
	content: string;

	@Field({nullable: true, description: 'Thinking or reasoning content'})
	thinking: string;

	@Field(() => [OrchardAiChatToolCall], {nullable: true, description: 'Tool calls requested by the model'})
	tool_calls: OrchardAiChatToolCall[];

	constructor(message: AiMessage) {
		this.role = message.role;
		this.content = message.content;
		this.thinking = message.thinking;
		this.tool_calls = message.tool_calls?.map((tool_call) => new OrchardAiChatToolCall(tool_call));
	}
}

@ObjectType({description: 'AI chat token usage statistics'})
export class OrchardAiChatUsage {
	@Field(() => Int, {nullable: true, description: 'Number of tokens in the prompt'})
	prompt_tokens?: number;

	@Field(() => Int, {nullable: true, description: 'Number of tokens in the completion'})
	completion_tokens?: number;

	@Field({nullable: true, description: 'Total processing duration in nanoseconds'})
	total_duration?: number;

	@Field({nullable: true, description: 'Evaluation duration in nanoseconds'})
	eval_duration?: number;

	constructor(usage: AiStreamUsage) {
		this.prompt_tokens = usage.prompt_tokens;
		this.completion_tokens = usage.completion_tokens;
		this.total_duration = usage.total_duration;
		this.eval_duration = usage.eval_duration;
	}
}

@ObjectType({description: 'AI chat streaming chunk'})
export class OrchardAiChatChunk {
	@Field({description: 'Stream identifier'})
	id: string;

	@Field({description: 'Model used for generation'})
	model: string;

	@Field(() => Int, {description: 'Unix timestamp when the chunk was generated'})
	created_at: number;

	@Field(() => OrchardAiChatMessage, {description: 'Message content of the chunk'})
	message: OrchardAiChatMessage;

	@Field({description: 'Whether the stream is complete'})
	done: boolean;

	@Field({nullable: true, description: 'Reason the stream finished'})
	done_reason: string;

	@Field(() => OrchardAiChatUsage, {nullable: true, description: 'Token usage statistics for the completed stream'})
	usage?: OrchardAiChatUsage;

	constructor(chunk: AiStreamChunk, id: string) {
		this.id = id;
		this.model = chunk.model;
		this.created_at = Math.floor(new Date(chunk.created_at).getTime() / 1000);
		this.message = new OrchardAiChatMessage(chunk.message);
		this.done = chunk.done;
		this.done_reason = chunk.done_reason;
		this.usage = chunk.usage ? new OrchardAiChatUsage(chunk.usage) : undefined;
	}
}

@ObjectType({description: 'AI chat stream reference'})
export class OrchardAiChatStream {
	@Field({description: 'Stream identifier'})
	id: string;
}
