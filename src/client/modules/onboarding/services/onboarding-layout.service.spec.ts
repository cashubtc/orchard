import {TestBed} from '@angular/core/testing';
import {BreakpointObserver, Breakpoints} from '@angular/cdk/layout';
import {of} from 'rxjs';
import {OnboardingLayoutService} from './onboarding-layout.service';

describe('OnboardingLayoutService', () => {
	it('uses the app phone breakpoint', () => {
		const observe = jasmine.createSpy().and.returnValue(of({matches: true}));
		TestBed.configureTestingModule({providers: [{provide: BreakpointObserver, useValue: {observe}}]});
		expect(TestBed.inject(OnboardingLayoutService).mobile()).toBeTrue();
		expect(observe).toHaveBeenCalledWith(Breakpoints.XSmall);
	});
});
