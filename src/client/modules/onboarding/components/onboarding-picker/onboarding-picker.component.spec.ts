import {TestBed} from '@angular/core/testing';
import {ServiceKind} from '@shared/generated.types';
import {OnboardingPickerComponent} from './onboarding-picker.component';

describe('OnboardingPickerComponent', () => {
	it('renders four optional cards including the ecash wallet, selection and a live count', () => {
		const fixture = TestBed.createComponent(OnboardingPickerComponent);
		fixture.componentRef.setInput('selected', [ServiceKind.Mint]);
		fixture.detectChanges();
		const toggled = jasmine.createSpy();
		fixture.componentInstance.toggled.subscribe(toggled);
		const cards = fixture.nativeElement.querySelectorAll('button[aria-pressed]');
		expect(cards.length).toBe(4);
		expect(cards[2].getAttribute('aria-pressed')).toBe('true');
		expect(cards[2].classList).toContain('selected');
		expect(cards[0].classList).not.toContain('selected');
		expect(cards[3].textContent).toContain('Ecash wallet');
		expect(fixture.nativeElement.textContent).toContain('Continue with 1 service');
		cards[0].click();
		expect(toggled).toHaveBeenCalledWith(ServiceKind.Bitcoin);
		cards[3].click();
		expect(toggled).toHaveBeenCalledWith('ecash');
		fixture.componentRef.setInput('selected', []);
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).toContain('Continue with 0 services');
		expect(fixture.nativeElement.querySelector('button[matButton="filled"]').disabled).toBeTrue();
	});
});
