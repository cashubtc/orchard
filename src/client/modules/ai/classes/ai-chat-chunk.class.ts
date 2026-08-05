/* Application Dependencies */
import {AiFunction} from '@client/modules/ai/types/ai.types';
/* Shared Dependencies */
import {OrchardAiChatChunk, OrchardAiChatMessage, OrchardAiChatToolCall, OrchardAiChatUsage, AiMessageRole} from '@shared/generated.types';

interface ParsedOrchardAiChatChunk extends Omit<OrchardAiChatChunk, 'message'> {
	message: {
		content: string;
		role: AiMessageRole;
		thinking?: string | null;
		tool_calls?: {
			function: AiFunction;
		}[];
	};
}

interface ParsedOrchardAiChatMessage extends Omit<OrchardAiChatMessage, 'tool_calls'> {
	tool_calls?: {
		function: AiFunction;
	}[];
}

interface ParsedOrchardAiChatToolCall extends Omit<OrchardAiChatToolCall, 'function'> {
	function: AiFunction;
}

export class AiChatChunk implements ParsedOrchardAiChatChunk {
	public created_at: number;
	public done: boolean;
	public done_reason: string | null;
	public id: string;
	public id_conversation: string;
	public message: AiChatMessage;
	public model: string;
	public usage: AiChatUsage | null;

    /** True once the chunk carries something renderable — leading empty chunks don't count.
	 *  Errors arrive as a normal ERROR-role chunk, so they count even if content is blank. */
	public get has_output(): boolean {
		const message = this.message;
		return message.role === AiMessageRole.Error || !!message.thinking || !!message.content || !!message.tool_calls?.length;
	}

	constructor(chunk: OrchardAiChatChunk, id_conversation: string) {
		this.created_at = chunk.created_at;
		this.done = chunk.done;
		this.done_reason = chunk.done_reason ?? null;
		this.id = chunk.id;
		this.id_conversation = id_conversation;
		this.message = new AiChatMessage(chunk.message);
		this.model = chunk.model;
		this.usage = chunk.usage ? new AiChatUsage(chunk.usage) : null;
	}
}

export class AiChatMessage implements ParsedOrchardAiChatMessage {
	public content: string;
	public role: AiMessageRole;
	public thinking?: string | null;
	public tool_calls?: AiChatToolCall[];

	constructor(message: OrchardAiChatMessage) {
		this.content = message.content;
		this.role = message.role;
		this.thinking = message.thinking ?? null;
		this.tool_calls = message.tool_calls?.map((tool_call: OrchardAiChatToolCall) => new AiChatToolCall(tool_call));
	}

}

export class AiChatToolCall implements ParsedOrchardAiChatToolCall {
	public function: AiFunction;

	constructor(tool_call: OrchardAiChatToolCall) {
		this.function = {
			name: tool_call.function.name,
			arguments: JSON.parse(tool_call.function.arguments),
		} as AiFunction;
	}
}

export class AiChatUsage {
	public prompt_tokens: number | null;
	public completion_tokens: number | null;
	public total_duration: number | null;
	public eval_duration: number | null;

	constructor(usage: OrchardAiChatUsage) {
		this.prompt_tokens = usage.prompt_tokens ?? null;
		this.completion_tokens = usage.completion_tokens ?? null;
		this.total_duration = usage.total_duration ?? null;
		this.eval_duration = usage.eval_duration ?? null;
	}
}
