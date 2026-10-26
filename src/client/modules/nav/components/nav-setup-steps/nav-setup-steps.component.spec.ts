import {TestBed} from '@angular/core/testing';
import {NavSetupStepsComponent} from './nav-setup-steps.component';

describe('NavSetupStepsComponent', () => {
	it('announces completion with its own hidden label and identifies the current step', () => {
		const fixture = TestBed.createComponent(NavSetupStepsComponent);
		fixture.componentRef.setInput('steps', ['Account', 'Services', 'Configure']);
		fixture.componentRef.setInput('current', 1);
		fixture.detectChanges();
		expect(fixture.nativeElement.querySelector('[aria-current="step"]').textContent).toContain('Services');
		const hidden: HTMLElement = fixture.nativeElement.querySelector('.cdk-visually-hidden');
		expect(hidden.textContent).toContain('Completed');
		expect(getComputedStyle(hidden).position).toBe('absolute');
	});

	it('renders the wizard pills with filled and outlined markers instead of numbers', () => {
		const fixture = TestBed.createComponent(NavSetupStepsComponent);
		fixture.componentRef.setInput('steps', ['Create', 'Enroll', 'Review']);
		fixture.componentRef.setInput('current', 1);
		fixture.componentRef.setInput('variant', 'pills');
		fixture.detectChanges();
		expect(fixture.nativeElement.classList).toContain('pills');
		expect(fixture.nativeElement.querySelector('.step-number')).toBeNull();
		const markers: string[] = Array.from<HTMLElement>(fixture.nativeElement.querySelectorAll('mat-icon')).map((icon) =>
			icon.textContent!.trim(),
		);
		expect(markers).toEqual(['check_circle', 'radio_button_checked', 'radio_button_unchecked']);
	});

	it('reads titles from step records', () => {
		const fixture = TestBed.createComponent(NavSetupStepsComponent);
		fixture.componentRef.setInput('steps', [{title: 'Create or join'}, {title: 'Enroll'}]);
		fixture.componentRef.setInput('current', 0);
		fixture.detectChanges();
		expect(fixture.componentInstance.steps()).toEqual(['Create or join', 'Enroll']);
		expect(fixture.nativeElement.querySelector('[aria-current="step"]').textContent).toContain('Create or join');
	});
});
