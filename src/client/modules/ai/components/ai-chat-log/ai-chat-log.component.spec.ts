/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcAiModule} from '@client/modules/ai/ai.module';
/* Local Dependencies */
import {AiChatLogComponent} from './ai-chat-log.component';

describe('AiChatLogComponent', () => {
	let component: AiChatLogComponent;
	let fixture: ComponentFixture<AiChatLogComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcAiModule],
			declarations: [AiChatLogComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(AiChatLogComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('conversation', {messages: []});
		fixture.componentRef.setInput('active_chat', false);
		fixture.componentRef.setInput('revision', 0);
		fixture.componentRef.setInput('assistant_definition', null);
		fixture.componentRef.setInput('user_name', '');
		fixture.componentRef.setInput('pending', false);
		fixture.componentRef.setInput('vendor', 'ollama');
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
