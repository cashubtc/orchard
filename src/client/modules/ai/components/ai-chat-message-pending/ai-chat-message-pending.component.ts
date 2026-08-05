/* Core Dependencies */
import {ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, input, signal} from '@angular/core';
/* Vendor Dependencies */
import {Subscription, timer} from 'rxjs';
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
export class AiChatMessagePendingComponent implements OnInit, OnDestroy {
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

	private subscriptions = new Subscription();

	ngOnInit(): void {
		this.subscriptions.add(timer(CONNECTING_MS).subscribe(() => this.connecting.set(false)));
	}

	/* *******************************************************
		Destroy
	******************************************************** */

	ngOnDestroy(): void {
		this.subscriptions.unsubscribe();
	}
}
