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

	it('hides issuing from non-admins and keeps send and receive disabled', () => {
		expect(buttons().length).toBe(2);
		expect(buttons().every((button) => button.disabled)).toBeTrue();
	});

	it('emits issue when an admin picks it', () => {
		const issue = jasmine.createSpy('issue');
		component.issue.subscribe(issue);
		fixture.componentRef.setInput('is_admin', true);
		fixture.detectChanges();

		buttons()[0].click();
		expect(issue).toHaveBeenCalled();
	});
});
