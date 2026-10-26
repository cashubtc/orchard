import {TestBed} from '@angular/core/testing';
import {MatIconTestingModule} from '@angular/material/icon/testing';
import {LocalStorageService} from '@client/modules/cache/services/local-storage/local-storage.service';
import {FEDERATION_BACKUP_ACKNOWLEDGEMENT} from '@client/modules/federation/constants/federation.constants';
import {FederationBackupComponent} from './federation-backup.component';

describe('FederationBackupComponent', () => {
	beforeEach(() => TestBed.configureTestingModule({imports: [MatIconTestingModule]}));

	it('lists what to back up and reports completion from the one confirmation', () => {
		const fixture = TestBed.createComponent(FederationBackupComponent);
		const component = fixture.componentInstance;
		const completions: boolean[] = [];
		component.complete.subscribe((complete) => completions.push(complete));
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelectorAll('.backup-contents li').length).toBe(3);
		expect(fixture.nativeElement.querySelectorAll('mat-checkbox').length).toBe(1);
		component.confirm(true);
		fixture.detectChanges();
		component.confirm(false);
		fixture.detectChanges();
		expect(completions).toEqual([false, true, false]);
	});
	it('leaves the heading and confirmation to the parent in the plain variant', () => {
		const fixture = TestBed.createComponent(FederationBackupComponent);
		fixture.componentRef.setInput('variant', 'plain');
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelectorAll('.backup-contents li').length).toBe(3);
		expect(fixture.nativeElement.querySelector('h2')).toBeNull();
		expect(fixture.nativeElement.querySelector('mat-checkbox')).toBeNull();
	});
	it('shows the mint backup warning verbatim', () => {
		const fixture = TestBed.createComponent(FederationBackupComponent);
		fixture.componentRef.setInput('warning', 'Back up federation-setup/\nand the database');
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.backup-warning').textContent).toBe('Back up federation-setup/\nand the database');
	});
	it('restores the confirmation after recreation, accepts earlier checklists and keeps another federation separate', () => {
		const storage = TestBed.inject(LocalStorageService);
		const saved = new Map<string, unknown>([
			['v0.federation.backup.acknowledgements.earlier', ['The mint database', FEDERATION_BACKUP_ACKNOWLEDGEMENT]],
		]);
		spyOn(storage, 'getItem').and.callFake(<T>(key: string): T | null => (saved.get(key) as T) ?? null);
		spyOn(storage, 'setItem').and.callFake((key: string, value: unknown) => {
			saved.set(key, value);
		});
		const first = TestBed.createComponent(FederationBackupComponent);
		first.componentRef.setInput('federation_id', 'first');
		first.detectChanges();
		first.componentInstance.confirm(true);
		first.destroy();
		const next = TestBed.createComponent(FederationBackupComponent);
		const complete = jasmine.createSpy();
		next.componentInstance.complete.subscribe(complete);
		next.componentRef.setInput('federation_id', 'first');
		next.detectChanges();
		expect(next.componentInstance.confirmed()).toBeTrue();
		expect(complete).toHaveBeenCalledWith(true);
		next.componentRef.setInput('federation_id', 'other');
		next.detectChanges();
		expect(next.componentInstance.confirmed()).toBeFalse();
		expect(complete).toHaveBeenCalledWith(false);
		next.componentRef.setInput('federation_id', 'earlier');
		next.detectChanges();
		expect(next.componentInstance.confirmed()).toBeTrue();
	});
});
