import {TestBed} from '@angular/core/testing';
import {LocalStorageService} from '@client/modules/cache/services/local-storage/local-storage.service';
import {FederationBackupComponent} from './federation-backup.component';

describe('FederationBackupComponent', () => {
	it('reports completion only once every item is acknowledged', () => {
		const fixture = TestBed.createComponent(FederationBackupComponent);
		const component = fixture.componentInstance;
		const completions: boolean[] = [];
		component.complete.subscribe((complete) => completions.push(complete));
		fixture.detectChanges();
		for (const item of component.items) {
			component.check(item, true);
			fixture.detectChanges();
		}
		component.check(component.items[0], false);
		fixture.detectChanges();
		expect(completions).toEqual([false, true, false]);
	});
	it('shows the mint backup warning verbatim', () => {
		const fixture = TestBed.createComponent(FederationBackupComponent);
		fixture.componentRef.setInput('warning', 'Back up federation-setup/\nand the database');
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('.backup-warning').textContent).toBe('Back up federation-setup/\nand the database');
	});
	it('restores acknowledgements after recreation and keeps another federation separate', () => {
		const storage = TestBed.inject(LocalStorageService);
		const saved = new Map<string, unknown>();
		spyOn(storage, 'getItem').and.callFake(<T>(key: string): T | null => (saved.get(key) as T) ?? null);
		spyOn(storage, 'setItem').and.callFake((key: string, value: unknown) => {
			saved.set(key, value);
		});
		const first = TestBed.createComponent(FederationBackupComponent);
		first.componentRef.setInput('federation_id', 'first');
		first.detectChanges();
		first.componentInstance.items.forEach((item) => first.componentInstance.check(item, true));
		first.destroy();
		const next = TestBed.createComponent(FederationBackupComponent);
		const complete = jasmine.createSpy();
		next.componentInstance.complete.subscribe(complete);
		next.componentRef.setInput('federation_id', 'first');
		next.detectChanges();
		expect(next.componentInstance.acknowledged()).toEqual([...next.componentInstance.items]);
		expect(complete).toHaveBeenCalledWith(true);
		next.componentRef.setInput('federation_id', 'other');
		next.detectChanges();
		expect(next.componentInstance.acknowledged()).toEqual([]);
		expect(complete).toHaveBeenCalledWith(false);
	});
});
