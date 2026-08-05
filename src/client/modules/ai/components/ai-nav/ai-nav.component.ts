/* Core Dependencies */
import {ChangeDetectionStrategy, Component, input, output, signal, effect} from '@angular/core';
/* Application Dependencies */
import {DeviceType} from '@client/modules/layout/types/device.types';
import {AiFavorites} from '@client/modules/cache/services/local-storage/local-storage.types';
/* Native Dependencies */
import {AiModel} from '@client/modules/ai/classes/ai-model.class';
import {AiChatConversation} from '@client/modules/ai/classes/ai-chat-conversation.class';
/* Shared Dependencies */
import {AiAssistant} from '@shared/generated.types';

@Component({
	selector: 'orc-ai-nav',
	standalone: false,
	templateUrl: './ai-nav.component.html',
	styleUrl: './ai-nav.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		'[class.collapsed]': '!opened()',
	},
})
export class AiNavComponent {
	/* Inputs */
	public active_assistant = input.required<AiAssistant>();
	public active_chat = input.required<boolean>();
	public model = input.required<string | null>();
	public model_options = input.required<AiModel[]>();
	public vendor = input<string>('ollama');
	public favorites = input<AiFavorites>({ollama: [], openrouter: []});
	public actionable = input.required<boolean>();
	public content = input.required<string>();
	public conversation = input.required<AiChatConversation | null>();
	public message_length = input<number>();
	public tool_length = input.required<number>();
	public log_open = input<boolean>();
	public opened = input<boolean>(false);
	public device_type = input.required<DeviceType>();
	public mobile_assistant = input.required<boolean>();
	public event_pending = input<boolean>(false);

	/* Outputs */
	public command = output<void>();
	public contentChange = output<string>();
	public modelChange = output<string>();
	public favoritesChange = output<AiFavorites>();
	public toggleLog = output<void>();
	public hideAssistant = output<void>();

	public focus = signal<boolean>(false);

	constructor() {
		effect(() => {
			if (this.mobile_assistant()) {
				this.focus.set(true);
			}
		});
	}

	/**
	 * Hides the assistant and resets the focus
	 */
	public onHideAssistant(): void {
		this.focus.set(false);
		this.hideAssistant.emit();
	}
}
