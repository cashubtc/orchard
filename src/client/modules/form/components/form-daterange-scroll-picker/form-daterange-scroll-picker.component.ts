/* Core Dependencies */
import {
	ChangeDetectionStrategy,
	Component,
	input,
	output,
	signal,
	computed,
	viewChild,
	ElementRef,
	ViewContainerRef,
	TemplateRef,
	OnDestroy,
} from '@angular/core';
/* Vendor Dependencies */
import {Overlay, OverlayRef} from '@angular/cdk/overlay';
import {Subscription} from 'rxjs';
import {TemplatePortal} from '@angular/cdk/portal';
import {DateRange, MatCalendarCellClassFunction} from '@angular/material/datepicker';
import {DateTime} from 'luxon';
/* Application Dependencies */
import {DeviceType} from '@client/modules/layout/types/device.types';
/* Native Dependencies */
import {FormScrollCalendarComponent} from '@client/modules/form/components/form-scroll-calendar/form-scroll-calendar.component';
import {DateRangePreset, DATE_RANGE_PRESET_OPTIONS, DateRangePresetOption} from '@client/modules/form/types/form-daterange.types';

@Component({
	selector: 'orc-form-daterange-scroll-picker',
	standalone: false,
	templateUrl: './form-daterange-scroll-picker.component.html',
	styleUrl: './form-daterange-scroll-picker.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormDaterangeScrollPickerComponent implements OnDestroy {
	public date_start = input<DateTime | null>(null);
	public date_end = input<DateTime | null>(null);
	public active_preset = input<string | null>(null);
	public preset_options = input<DateRangePresetOption[]>(DATE_RANGE_PRESET_OPTIONS);
	public min = input<DateTime | null>(null);
	public max = input<DateTime | null>(null);
	public dateClass = input<MatCalendarCellClassFunction<DateTime>>(() => '');
	public device_type = input<DeviceType>('desktop');

	public presetChange = output<DateRangePreset>();
	public dateRangeChange = output<DateRange<DateTime>>();
	public closed = output<void>();

	public panel_template = viewChild.required<TemplateRef<unknown>>('panelTemplate');
	public scroll_calendar = viewChild<FormScrollCalendarComponent>('scrollCalendar');
	public trigger_el = viewChild.required<ElementRef>('triggerButton');

	public is_open = signal(false);

	public current_range = computed(() => {
		return new DateRange<DateTime>(this.date_start(), this.date_end());
	});

	private overlay_ref: OverlayRef | null = null;
	private overlay_subs: Subscription[] = [];
	private overlay: Overlay;
	private view_container_ref: ViewContainerRef;
	private element_ref: ElementRef;

	constructor(overlay: Overlay, view_container_ref: ViewContainerRef, element_ref: ElementRef) {
		this.overlay = overlay;
		this.view_container_ref = view_container_ref;
		this.element_ref = element_ref;
	}

	/** Toggles the picker panel open/closed */
	public togglePanel(): void {
		if (this.is_open()) {
			this.closePanel();
		} else {
			this.openPanel();
		}
	}

	/** Opens the picker overlay panel */
	public openPanel(): void {
		if (this.overlay_ref) return;

		const origin = this.element_ref.nativeElement.closest('mat-form-field') ?? this.element_ref;
		const position_strategy = this.overlay
			.position()
			.flexibleConnectedTo(origin)
			.withPositions([
				{originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4},
				{originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4},
				{originX: 'end', originY: 'bottom', overlayX: 'end', overlayY: 'top', offsetY: 4},
			]);

		this.overlay_ref = this.overlay.create({
			positionStrategy: position_strategy,
			hasBackdrop: true,
			backdropClass: 'cdk-overlay-transparent-backdrop',
			scrollStrategy: this.overlay.scrollStrategies.reposition(),
		});

		const portal = new TemplatePortal(this.panel_template(), this.view_container_ref);
		this.overlay_ref.attach(portal);
		this.is_open.set(true);

		this.overlay_subs.push(
			this.overlay_ref.backdropClick().subscribe(() => this.closePanel()),
			this.overlay_ref.keydownEvents().subscribe((event) => {
				if (event.key === 'Escape') {
					this.closePanel();
				}
			}),
		);

		setTimeout(() => {
			this.scroll_calendar()?.initFromSelection();
		});
	}

	/** Closes the picker overlay panel */
	public closePanel(): void {
		this.destroyOverlay();
		this.is_open.set(false);
		this.closed.emit();
	}

	/** Handles preset selection from the list */
	public onPresetSelected(preset: DateRangePreset): void {
		this.presetChange.emit(preset);
		this.destroyOverlay();
		this.is_open.set(false);
	}

	/** Handles calendar range selection */
	public onCalendarRangeChange(range: DateRange<DateTime>): void {
		this.dateRangeChange.emit(range);
		this.destroyOverlay();
		this.is_open.set(false);
	}

	/** Destroys the overlay ref and cleans up subscriptions */
	private destroyOverlay(): void {
		this.overlay_subs.forEach((s) => s.unsubscribe());
		this.overlay_subs = [];
		if (this.overlay_ref) {
			this.overlay_ref.dispose();
			this.overlay_ref = null;
		}
	}

	ngOnDestroy(): void {
		this.destroyOverlay();
	}
}
