/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcAiModule} from '@client/modules/ai/ai.module';
import {AiAssistantDefinition} from '@client/modules/ai/classes/ai-assistant-definition.class';
/* Local Dependencies */
import {AiAgentChipComponent} from './ai-agent-chip.component';

describe('AiAgentChipComponent', () => {
	let component: AiAgentChipComponent;
	let fixture: ComponentFixture<AiAgentChipComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcAiModule],
		}).compileComponents();

		fixture = TestBed.createComponent(AiAgentChipComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput(
			'definition',
			new AiAssistantDefinition({
				name: 'Mint Keysets',
				description: '',
				icon: 'account_balance',
				section: 'mint',
				system_message: {content: '', role: 'system'},
				tools: [],
			}),
		);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
