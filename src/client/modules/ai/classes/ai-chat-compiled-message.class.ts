/* Vendor Dependencies */
import {v4 as uuidv4} from 'uuid';
/* Native Dependencies */
import {AiChatChunk, AiChatMessage, AiChatToolCall} from '@client/modules/ai/classes/ai-chat-chunk.class';
/* Shared Dependencies */
import {AiMessageRole} from '@shared/generated.types';

export class AiChatCompiledMessage {
	public id: string;
	public id_conversation: string;
	public content: string;
	public thinking?: string | null;
	public role: AiMessageRole;
	public tool_calls?: AiChatToolCall[];
	public done: boolean;

	constructor(id_conversation: string, message: AiChatMessage) {
		this.id = uuidv4();
		this.id_conversation = id_conversation;
		this.content = message.content;
		this.thinking = message.thinking;
		this.role = message.role;
		this.tool_calls = message.tool_calls || [];
		this.done = false;
	}

	public integrateChunk(chunk: AiChatChunk): void {
		this.content += chunk.message.content;
		if (chunk.message.thinking) this.thinking += chunk.message.thinking;
		if (chunk.message.tool_calls) this.tool_calls?.push(...chunk.message.tool_calls);
		if (chunk.done) this.done = true;
	}

	public getMessage(): AiChatMessage {
		return {
			role: this.role,
			content: this.content,
			thinking: this.thinking,
		};
	}
}
