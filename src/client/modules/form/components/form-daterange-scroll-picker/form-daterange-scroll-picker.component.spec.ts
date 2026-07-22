/* Core Dependencies */
import {ComponentFixture, TestBed} from '@angular/core/testing';
/* Vendor Dependencies */
import {OverlayContainer} from '@angular/cdk/overlay';
import {DateRange} from '@angular/material/datepicker';
import {DateTime} from 'luxon';
/* Native Dependencies */
import {OrcFormModule} from '@client/modules/form/form.module';
import {DateRangePreset, METRICS_DATE_RANGE_PRESET_OPTIONS} from '@client/modules/form/types/form-daterange.types';
/* Local Dependencies */
import {FormDaterangeScrollPickerComponent} from './form-daterange-scroll-picker.component';

describe('FormDaterangeScrollPickerComponent', () => {
	let component: FormDaterangeScrollPickerComponent;
	let fixture: ComponentFixture<FormDaterangeScrollPickerComponent>;
	let overlay_container: OverlayContainer;
	let overlay_container_el: HTMLElement;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OrcFormModule],
		}).compileComponents();

		overlay_container = TestBed.inject(OverlayContainer);
		overlay_container_el = overlay_container.getContainerElement();

		fixture = TestBed.createComponent(FormDaterangeScrollPickerComponent);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	afterEach(() => {
		component.closePanel();
		overlay_container.ngOnDestroy();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});

	it('should initialize with panel closed', () => {
		expect(component.is_open()).toBe(false);
	});

	it('should default to the day-granularity preset options', () => {
		expect(component.preset_options().length).toBe(7);
	});

	it('should use the preset options provided via input', () => {
		fixture.componentRef.setInput('preset_options', METRICS_DATE_RANGE_PRESET_OPTIONS);
		fixture.detectChanges();
		expect(component.preset_options().length).toBe(METRICS_DATE_RANGE_PRESET_OPTIONS.length);
	});

	it('should compute current_range from date_start and date_end inputs', () => {
		const range = component.current_range();
		expect(range).toBeInstanceOf(DateRange);
		expect(range.start).toBeNull();
		expect(range.end).toBeNull();
	});

	describe('togglePanel', () => {
		it('should open panel when closed', () => {
			component.togglePanel();
			expect(component.is_open()).toBe(true);
		});

		it('should close panel when open', () => {
			component.openPanel();
			expect(component.is_open()).toBe(true);

			component.togglePanel();
			expect(component.is_open()).toBe(false);
		});
	});

	describe('openPanel', () => {
		it('should set is_open to true', () => {
			component.openPanel();
			expect(component.is_open()).toBe(true);
		});

		it('should create an overlay', () => {
			component.openPanel();
			const overlay_pane = overlay_container_el.querySelector('.cdk-overlay-pane');
			expect(overlay_pane).toBeTruthy();
		});

		it('should not open a second overlay if already open', () => {
			component.openPanel();
			component.openPanel();
			const overlay_panes = overlay_container_el.querySelectorAll('.cdk-overlay-pane');
			expect(overlay_panes.length).toBe(1);
		});

		it('should close panel on backdrop click', () => {
			component.openPanel();
			const backdrop = overlay_container_el.querySelector('.cdk-overlay-backdrop') as HTMLElement;
			backdrop.click();
			expect(component.is_open()).toBe(false);
		});

		it('should close panel on Escape key', () => {
			component.openPanel();
			const event = new KeyboardEvent('keydown', {key: 'Escape'});
			document.body.dispatchEvent(event);
			expect(component.is_open()).toBe(false);
		});
	});

	describe('closePanel', () => {
		it('should set is_open to false', () => {
			component.openPanel();
			component.closePanel();
			expect(component.is_open()).toBe(false);
		});

		it('should emit closed event', () => {
			const spy = jasmine.createSpy('closed');
			component.closed.subscribe(spy);

			component.openPanel();
			component.closePanel();
			expect(spy).toHaveBeenCalled();
		});

		it('should dispose the overlay', () => {
			component.openPanel();
			component.closePanel();
			const overlay_pane = overlay_container_el.querySelector('.cdk-overlay-pane');
			expect(overlay_pane).toBeFalsy();
		});
	});

	describe('onPresetSelected', () => {
		it('should emit presetChange with the selected preset', () => {
			const spy = jasmine.createSpy('presetChange');
			component.presetChange.subscribe(spy);

			component.openPanel();
			component.onPresetSelected(DateRangePreset.Last7Days);
			expect(spy).toHaveBeenCalledWith(DateRangePreset.Last7Days);
		});

		it('should close the panel', () => {
			component.openPanel();
			component.onPresetSelected(DateRangePreset.Last30Days);
			expect(component.is_open()).toBe(false);
		});

		it('should not emit closed event', () => {
			const spy = jasmine.createSpy('closed');
			component.closed.subscribe(spy);

			component.openPanel();
			component.onPresetSelected(DateRangePreset.ThisYear);
			expect(spy).not.toHaveBeenCalled();
		});
	});

	describe('onCalendarRangeChange', () => {
		it('should emit dateRangeChange with the selected range', () => {
			const spy = jasmine.createSpy('dateRangeChange');
			component.dateRangeChange.subscribe(spy);

			const range = new DateRange<DateTime>(DateTime.now().minus({days: 7}), DateTime.now());
			component.openPanel();
			component.onCalendarRangeChange(range);
			expect(spy).toHaveBeenCalledWith(range);
		});

		it('should close the panel', () => {
			const range = new DateRange<DateTime>(DateTime.now().minus({days: 7}), DateTime.now());
			component.openPanel();
			component.onCalendarRangeChange(range);
			expect(component.is_open()).toBe(false);
		});

		it('should not emit closed event', () => {
			const spy = jasmine.createSpy('closed');
			component.closed.subscribe(spy);

			const range = new DateRange<DateTime>(DateTime.now().minus({days: 7}), DateTime.now());
			component.openPanel();
			component.onCalendarRangeChange(range);
			expect(spy).not.toHaveBeenCalled();
		});
	});

	describe('ngOnDestroy', () => {
		it('should dispose the overlay on destroy', () => {
			component.openPanel();
			component.ngOnDestroy();
			const overlay_pane = overlay_container_el.querySelector('.cdk-overlay-pane');
			expect(overlay_pane).toBeFalsy();
		});
	});
});
