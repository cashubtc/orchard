/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Application Dependencies */
import {OrchardErrors} from '@client/modules/error/classes/error.class';
/* Native Dependencies */
import {EventData} from '@client/modules/event/classes/event-data.class';
/* Local Dependencies */
import {EventGeneralStackMessageComponent} from './event-general-stack-message.component';

describe('EventGeneralStackMessageComponent', () => {
	let component: EventGeneralStackMessageComponent;
	let fixture: ComponentFixture<EventGeneralStackMessageComponent>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			declarations: [EventGeneralStackMessageComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(EventGeneralStackMessageComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	for (const scenario of [
		{code: 20001, message: 'BitcoinRpcError', expected: 'connect to the bitcoin RPC'},
		{code: 30002, message: 'LightningRpcActionError', expected: 'lightning RPC action failed'},
		{code: 40006, message: 'MintRpcActionError', expected: 'Check the event log for details'},
		{code: 60002, message: 'TaprootAssetsRpcActionError', expected: 'taproot assets RPC action failed'},
		{code: 99999, message: 'FutureBackendError', expected: 'FutureBackendError'},
	]) {
		it(`renders error ${scenario.code} with its explanation and support code`, () => {
			const error = new OrchardErrors([{message: scenario.message, extensions: {code: scenario.code}}]).errors[0];
			fixture.componentRef.setInput('event', new EventData({type: 'ERROR', message: error.getFullError()}));
			fixture.detectChanges();
			const element: HTMLElement = fixture.nativeElement;
			const toast = element.querySelector('.event-error .event-message-content');
			expect(toast).not.toBeNull();
			expect(toast?.textContent).toContain(scenario.expected);
			expect(toast?.textContent).toContain(String(scenario.code));
		});
	}

	it('surfaces the backend diagnostic in place of the catalog explanation', () => {
		const details = 'A configuration apply is pending; restart cdk-mintd before making management RPC changes';
		const error = new OrchardErrors([{message: 'MintRpcActionError', extensions: {code: 40006, details}}]).errors[0];
		fixture.componentRef.setInput('event', new EventData({type: 'ERROR', message: error.getFullError()}));
		fixture.detectChanges();
		const element: HTMLElement = fixture.nativeElement;
		const toast = element.querySelector('.event-error .event-message-content');
		expect(toast?.textContent).toContain(details);
		expect(toast?.textContent).toContain('40006');
	});

	for (const scenario of [
		{type: 'SUCCESS' as const, message: 'Information updated!', class_name: 'event-success'},
		{type: 'WARNING' as const, message: 'No changes to save', class_name: 'event-warning'},
	]) {
		it(`preserves ordinary ${scenario.type.toLowerCase()} toast wording`, () => {
			fixture.componentRef.setInput('event', new EventData(scenario));
			fixture.detectChanges();
			const element: HTMLElement = fixture.nativeElement;
			expect(element.querySelector(`.${scenario.class_name} .event-message-content`)?.textContent).toBe(scenario.message);
		});
	}
});
