/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, effect, ElementRef, input, output, viewChild} from '@angular/core';
/* Native Dependencies */
import {AiAssistantDefinition} from '@client/modules/ai/classes/ai-assistant-definition.class';

@Component({
	selector: 'orc-ai-input',
	standalone: false,
	templateUrl: './ai-input.component.html',
	styleUrl: './ai-input.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiInputComponent {
	public active_chat = input.required<boolean>();
	public model = input.required<string | null>();
	public content = input.required<string>();
	public focus = input<boolean>(false);
	public assistant_definition = input<AiAssistantDefinition | null>(null);
	public icon_only = input<boolean>(false);

	public chat = output<void>();
	public contentChange = output<string>();

	public input_el = viewChild<ElementRef<HTMLTextAreaElement>>('inputEl');

	public placeholder = computed(() => (this.active_chat() ? 'Generating...' : 'Message assistant...'));

	constructor() {
		effect(() => {
			if (this.focus()) {
				setTimeout(() => {
					this.input_el()?.nativeElement.focus();
				}, 100);
			}
		});
	}

	/**
	 * Sends the typed value up so the owning component can store it
	 * @param event the native input event
	 */
	public onInput(event: Event): void {
		this.contentChange.emit((event.target as HTMLTextAreaElement).value);
	}

	public onSubmit(event?: Event): void {
		if (event) event.preventDefault();
		this.chat.emit();
	}
}
