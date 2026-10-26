import {TestBed} from '@angular/core/testing';
import {MatIconTestingModule} from '@angular/material/icon/testing';
import {FederationSetupStartComponent} from './federation-setup-start.component';

describe('FederationSetupStartComponent', () => {
	it('offers Create and Join only to administrators, and explains the five steps', () => {
		TestBed.configureTestingModule({imports: [MatIconTestingModule]});
		const fixture = TestBed.createComponent(FederationSetupStartComponent);
		fixture.detectChanges();
		const actions: HTMLButtonElement[] = Array.from(fixture.nativeElement.querySelectorAll('.choice-card button'));
		expect(actions.map((button) => button.textContent?.replace('arrow_forward', '').trim())).toEqual(['Create', 'Join']);
		expect(actions.every((button) => button.disabled)).toBeTrue();
		expect(fixture.nativeElement.querySelectorAll('.setup-how li').length).toBe(5);
		fixture.componentRef.setInput('admin', true);
		fixture.detectChanges();
		const chosen = jasmine.createSpy();
		fixture.componentInstance.chosen.subscribe(chosen);
		actions[1].click();
		expect(chosen).toHaveBeenCalledWith('join');
	});
});
