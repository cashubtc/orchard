/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcAiModule} from '@client/modules/ai/ai.module';
/* Local Dependencies */
import {AiInputComponent} from './ai-input.component';

describe('AiInputComponent', () => {
	let component: AiInputComponent;
	let fixture: ComponentFixture<AiInputComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcAiModule],
		}).compileComponents();

		fixture = TestBed.createComponent(AiInputComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('content', '');
		fixture.componentRef.setInput('model', 'test-model');
		fixture.componentRef.setInput('active_chat', false);
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
