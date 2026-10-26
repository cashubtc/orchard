import {MatIconTestingModule} from '@angular/material/icon/testing';
import {TestBed} from '@angular/core/testing';
import {onboardingReview} from '@client/modules/onboarding/helpers/onboarding.helpers';
import {ServiceKind} from '@shared/generated.types';
import {OnboardingReviewComponent} from './onboarding-review.component';

describe('OnboardingReviewComponent', () => {
	it('shows neutral skipped rows, allows Add, and only offers opening the applied setup', () => {
		TestBed.configureTestingModule({imports: [MatIconTestingModule]});
		const fixture = TestBed.createComponent(OnboardingReviewComponent);
		fixture.componentRef.setInput('rows', onboardingReview([], {}));
		fixture.componentRef.setInput('setup_mode', true);
		fixture.detectChanges();
		const statuses = fixture.nativeElement.querySelectorAll('.review-status');
		expect(statuses.length).toBe(3);
		expect(statuses[1].textContent).toContain('Skipped');
		expect(fixture.nativeElement.textContent).toContain('Federation setup');
		expect(fixture.nativeElement.textContent).not.toContain('Apply and open');
		const edited = jasmine.createSpy();
		fixture.componentInstance.edited.subscribe(edited);
		fixture.nativeElement.querySelector('button[aria-label="Add Lightning"]').click();
		expect(edited).toHaveBeenCalledWith(ServiceKind.Lightning);
	});
});
