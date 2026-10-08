/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcEcashGeneralModule} from '@client/modules/ecash/modules/ecash-general/ecash-general.module';
/* Local Dependencies */
import {EcashGeneralActionsComponent} from './ecash-general-actions.component';

describe('EcashGeneralActionsComponent', () => {
	let component: EcashGeneralActionsComponent;
	let fixture: ComponentFixture<EcashGeneralActionsComponent>;

	const buttons = (): HTMLButtonElement[] => Array.from(fixture.nativeElement.querySelectorAll('button'));

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcEcashGeneralModule],
		}).compileComponents();

		fixture = TestBed.createComponent(EcashGeneralActionsComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('device_type', 'desktop');
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('hides issuing when it is not allowed and keeps send and receive disabled', () => {
		expect(buttons().length).toBe(2);
		expect(buttons().every((button) => button.disabled)).toBeTrue();
	});

	it("disables issuing with the reason in place of its detail when the mint can't issue", () => {
		fixture.componentRef.setInput('can_issue', true);
		fixture.componentRef.setInput('issue_blocked', 'Minting is disabled on your mint');
		fixture.detectChanges();

		expect(buttons()[0].disabled).toBeTrue();
		expect(buttons()[0].textContent).toContain('Minting is disabled on your mint');
	});

	it('emits issue when picked', () => {
		const issue = jasmine.createSpy('issue');
		component.issue.subscribe(issue);
		fixture.componentRef.setInput('can_issue', true);
		fixture.detectChanges();

		buttons()[0].click();
		expect(issue).toHaveBeenCalled();
	});
});
