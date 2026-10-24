import {TestBed} from '@angular/core/testing';
import {FederationBackupComponent} from './federation-backup.component';

describe('FederationBackupComponent', () => {
	it('reports completion only once every item is acknowledged', () => {
		const fixture = TestBed.createComponent(FederationBackupComponent);
		const component = fixture.componentInstance;
		const completions: boolean[] = [];
		component.complete.subscribe((complete) => completions.push(complete));
		component.items.forEach((_, index) => component.check(index, true));
		component.check(0, false);
		expect(completions).toEqual([...component.items.map((_, index) => index === component.items.length - 1), false]);
	});
	it('shows the mint backup warning verbatim', () => {
		const fixture = TestBed.createComponent(FederationBackupComponent);
		fixture.componentRef.setInput('warning', 'Back up federation-setup/\nand the database');
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.backup-warning').textContent).toBe('Back up federation-setup/\nand the database');
	});
});
