/* Core Dependencies */
import {InputType, Field} from '@nestjs/graphql';
/* Application Dependencies */
import {AiAssistant} from '#server/modules/ai/assistant/ai.assistant.enums';
import {AiMessageRole} from '#server/modules/ai/ai.enums';

@InputType({description: 'Input for a single chat message'})
export class AiChatMessageInput {
	@Field(() => AiMessageRole, {description: 'Role of the message sender'})
	role: AiMessageRole;

	@Field({description: 'Message text content'})
	content: string;

	@Field({nullable: true, description: 'Thinking or reasoning content'})
	thinking: string;
}

@InputType({description: 'Input for sending a chat message'})
export class AiChatInput {
	@Field({description: 'Unique stream identifier'})
	id: string;

	@Field({description: 'AI model to use for generation'})
	model: string;

	@Field(() => AiAssistant, {nullable: true, description: 'Optional assistant to use'})
	assistant: AiAssistant | null;

	@Field(() => [AiChatMessageInput], {description: 'Conversation message history'})
	messages: AiChatMessageInput[];
}
