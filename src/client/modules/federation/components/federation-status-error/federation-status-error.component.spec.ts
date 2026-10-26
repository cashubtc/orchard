import {TestBed} from '@angular/core/testing';
import {FederationStatusErrorComponent} from './federation-status-error.component';

describe('FederationStatusErrorComponent', () => {
	it('announces the source and preserves the daemon diagnostic', () => {
		const fixture = TestBed.createComponent(FederationStatusErrorComponent);
		fixture.componentRef.setInput('source', 'Custody');
		fixture.componentRef.setInput('error', {code: 40016, message: 'Busy', details: '14 UNAVAILABLE: wallet offline'});
		fixture.detectChanges();
		const alert = fixture.nativeElement.querySelector('[role="alert"]');
		expect(alert.textContent).toContain('Custody could not be refreshed');
		expect(alert.textContent).toContain('14 UNAVAILABLE: wallet offline');
	});
});
