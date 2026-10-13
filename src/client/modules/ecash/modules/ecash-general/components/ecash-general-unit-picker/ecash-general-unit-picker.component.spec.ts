/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Native Dependencies */
import {OrcEcashGeneralModule} from '@client/modules/ecash/modules/ecash-general/ecash-general.module';
/* Local Dependencies */
import {EcashGeneralUnitPickerComponent} from './ecash-general-unit-picker.component';

describe('EcashGeneralUnitPickerComponent', () => {
	let component: EcashGeneralUnitPickerComponent;
	let fixture: ComponentFixture<EcashGeneralUnitPickerComponent>;

	const options = (): HTMLButtonElement[] => Array.from(document.querySelectorAll('.ecash-unit-picker-option'));

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcEcashGeneralModule],
		}).compileComponents();

		fixture = TestBed.createComponent(EcashGeneralUnitPickerComponent);
		component = fixture.componentInstance;
		fixture.componentRef.setInput('chips', [
			{unit: 'sat', amount: 601},
			{unit: 'usd', amount: 4678},
		]);
		fixture.componentRef.setInput('selected', 'sat');
		fixture.componentRef.setInput('title', 'Issue in');
		fixture.detectChanges();
	});

	afterEach(() => fixture.destroy());

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('lists the units over the page, the selected one checked', () => {
		component.onOpen();
		fixture.detectChanges();
		expect(component.is_open()).toBeTrue();
		expect(options().map((option) => option.getAttribute('aria-checked'))).toEqual(['true', 'false']);
	});

	it('closes on Escape or a tap outside', () => {
		component.onOpen();
		document.body.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
		expect(component.is_open()).toBeFalse();

		component.onOpen();
		(document.querySelector('.cdk-overlay-backdrop') as HTMLElement).click();
		expect(component.is_open()).toBeFalse();
	});

	it('takes its list away with it when destroyed while open', () => {
		component.onOpen();
		fixture.detectChanges();
		fixture.destroy();
		expect(options().length).toBe(0);
	});

	it('picks a unit and closes', () => {
		const picked = jasmine.createSpy('select');
		component.select.subscribe(picked);
		component.onOpen();
		fixture.detectChanges();

		options()[1].click();
		expect(picked).toHaveBeenCalledWith('usd');
		expect(component.is_open()).toBeFalse();
		expect(options().length).toBe(0);
	});
});
