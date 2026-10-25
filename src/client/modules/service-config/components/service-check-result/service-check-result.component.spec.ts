import {TestBed} from '@angular/core/testing';
import {ServiceCheckResultComponent} from './service-check-result.component';

describe('ServiceCheckResultComponent', () => {
	it('renders the exact diagnostic as text with a copy action', () => {
		const fixture = TestBed.createComponent(ServiceCheckResultComponent);
		fixture.componentRef.setInput('result', {
			ok: false,
			warning: false,
			title: 'Connection failed',
			context: 'localhost:1 · gRPC',
			diagnostic: 'connect ECONNREFUSED <127.0.0.1:1>',
			fields: ['host', 'port'],
		});
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('pre').textContent).toBe('connect ECONNREFUSED <127.0.0.1:1>');
		expect(fixture.nativeElement.textContent).toContain('Copy diagnostic');
		expect(fixture.nativeElement.querySelector('.orc-error-card')).toBeTruthy();
	});

	it('styles a partial success as a warning, not a failure', () => {
		const fixture = TestBed.createComponent(ServiceCheckResultComponent);
		fixture.componentRef.setInput('result', {
			ok: true,
			warning: true,
			title: 'Mint RPC connected; database could not be opened',
			context: '',
			diagnostic: 'Unable to open database',
			fields: ['database'],
		});
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.orc-warning-card')).toBeTruthy();
		expect(fixture.nativeElement.querySelector('.orc-error-card')).toBeNull();
	});
});
