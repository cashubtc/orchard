/* Core Dependencies */
import {ChangeDetectionStrategy, Component, Input} from '@angular/core';
/* Native Dependencies */
import {AiAssistantDefinition} from '@client/modules/ai/classes/ai-assistant-definition.class';

@Component({
	selector: 'orc-ai-assistant',
	standalone: false,
	templateUrl: './ai-assistant.component.html',
	styleUrl: './ai-assistant.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiAssistantComponent {
	@Input() public assistant!: AiAssistantDefinition | null;
}
