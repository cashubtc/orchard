/* Core Dependencies */
import {ChangeDetectionStrategy, Component, input, output, signal} from '@angular/core';
/* Native Dependencies */
import {AiChatConversation} from '@client/modules/ai/classes/ai-chat-conversation.class';
import {AiAssistantDefinition} from '@client/modules/ai/classes/ai-assistant-definition.class';

@Component({
	selector: 'orc-ai-chat-log',
	standalone: false,
	templateUrl: './ai-chat-log.component.html',
	styleUrl: './ai-chat-log.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiChatLogComponent {
	public conversation = input.required<AiChatConversation | null>();
	public active_chat = input.required<boolean>();
	public revision = input.required<number>();
	public assistant_definition = input.required<AiAssistantDefinition | null>();
	public user_name = input.required<string>();
	public pending = input.required<boolean>();
	public vendor = input.required<string>();

	public clear = output<void>();
	public close = output<void>();

	public view = signal(1);

	public setView(index: number) {
		this.view.set(index);
	}
}
