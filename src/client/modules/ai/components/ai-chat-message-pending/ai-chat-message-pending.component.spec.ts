/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcAiModule} from '@client/modules/ai/ai.module';
/* Local Dependencies */
import {AiChatMessagePendingComponent} from './ai-chat-message-pending.component';

describe('AiChatMessagePendingComponent', () => {
	let component: AiChatMessagePendingComponent;
	let fixture: ComponentFixture<AiChatMessagePendingComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcAiModule],
		}).compileComponents();

		fixture = TestBed.createComponent(AiChatMessagePendingComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('assistant', null);
		fixture.componentRef.setInput('vendor', 'ollama');
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should start on the connecting label', () => {
		expect(component.label()).toBe('Connecting');
	});

	it('should name the model load for ollama once connecting elapses', () => {
		component.connecting.set(false);
		expect(component.label()).toBe('Loading model');
	});

	it('should not claim a model load for a cloud vendor', () => {
		fixture.componentRef.setInput('vendor', 'openrouter');
		component.connecting.set(false);
		expect(component.label()).toBe('Contacting provider');
	});
});
