/* Core Dependencies */
import {ChangeDetectionStrategy, Component, OnDestroy, computed, input, signal} from '@angular/core';
/* Native Dependencies */
import {AiAssistantDefinition} from '@client/modules/ai/classes/ai-assistant-definition.class';
/* Shared Dependencies */
import {AiMessageRole} from '@shared/generated.types';

const CONNECTING_MS = 2000;

@Component({
	selector: 'orc-ai-chat-message-pending',
	standalone: false,
	templateUrl: './ai-chat-message-pending.component.html',
	styleUrl: './ai-chat-message-pending.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiChatMessagePendingComponent implements OnDestroy {
	public assistant = input.required<AiAssistantDefinition | null>();
	public vendor = input.required<string>();

	public readonly assistant_role = AiMessageRole.Assistant;

	public readonly connecting = signal<boolean>(true);

	// Cloud vendors never load weights — the wait there is provider routing, so
	// naming a local model load would send an operator hunting the wrong problem.
	public readonly label = computed(() => {
		if (this.connecting()) return 'Connecting';
		return this.vendor() === 'ollama' ? 'Loading model' : 'Contacting provider';
	});

	private connecting_timeout?: ReturnType<typeof setTimeout>;

	constructor() {
		this.connecting_timeout = setTimeout(() => this.connecting.set(false), CONNECTING_MS);
	}

	/* *******************************************************
		Destroy
	******************************************************** */

	ngOnDestroy(): void {
		if (this.connecting_timeout) clearTimeout(this.connecting_timeout);
	}
}
