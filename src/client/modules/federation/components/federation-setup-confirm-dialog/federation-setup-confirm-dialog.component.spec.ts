import {TestBed} from '@angular/core/testing';
import {MAT_DIALOG_DATA} from '@angular/material/dialog';
import {FederationSetupConfirmDialogComponent} from './federation-setup-confirm-dialog.component';

describe('FederationSetupConfirmDialogComponent', () => {
	it('explains the local irreversible abort and focuses cancel', () => {
		TestBed.configureTestingModule({providers: [{provide: MAT_DIALOG_DATA, useValue: {action: 'abort'}}]});
		const fixture = TestBed.createComponent(FederationSetupConfirmDialogComponent);
		fixture.detectChanges();
		const content = fixture.nativeElement as HTMLElement;
		expect(content.textContent).toContain('cannot be undone');
		expect(content.textContent).toContain('not notified');
		expect(content.textContent).toContain('own mint');
		expect(content.textContent).toContain('new setup ID');
		expect(content.querySelector('[cdkFocusInitial]')?.textContent).toContain('Cancel');
	});
	it('identifies the slot and warns that its old invitation stops working', () => {
		TestBed.configureTestingModule({providers: [{provide: MAT_DIALOG_DATA, useValue: {action: 'replace', member_id: 2}}]});
		const fixture = TestBed.createComponent(FederationSetupConfirmDialogComponent);
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('member 2 stops working');
	});
});
