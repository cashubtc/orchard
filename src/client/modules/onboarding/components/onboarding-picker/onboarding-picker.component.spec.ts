import {TestBed} from '@angular/core/testing';
import {ServiceKind} from '@shared/generated.types';
import {OnboardingPickerComponent} from './onboarding-picker.component';

describe('OnboardingPickerComponent', () => {
	it('renders three optional cards, selection and a live count without an Ecash card', () => {
		const fixture = TestBed.createComponent(OnboardingPickerComponent);
		fixture.componentRef.setInput('selected', [ServiceKind.Mint]);
		fixture.detectChanges();
		const toggled = jasmine.createSpy();
		fixture.componentInstance.toggled.subscribe(toggled);
		const cards = fixture.nativeElement.querySelectorAll('button[aria-pressed]');
		expect(cards.length).toBe(3);
		expect(cards[2].getAttribute('aria-pressed')).toBe('true');
		expect(fixture.nativeElement.textContent).toContain('Continue with 1 service');
		expect(fixture.nativeElement.textContent).not.toContain('Ecash');
		cards[0].click();
		expect(toggled).toHaveBeenCalledWith(ServiceKind.Bitcoin);
		fixture.componentRef.setInput('selected', []);
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('Continue with 0 services');
		expect(fixture.nativeElement.querySelector('button[matButton="filled"]').disabled).toBeTrue();
	});
});
