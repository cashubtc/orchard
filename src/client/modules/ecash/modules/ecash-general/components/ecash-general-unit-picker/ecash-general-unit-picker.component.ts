/* Core Dependencies */
import {
	ChangeDetectionStrategy,
	Component,
	OnDestroy,
	TemplateRef,
	ViewContainerRef,
	inject,
	input,
	output,
	signal,
	viewChild,
} from '@angular/core';
/* Vendor Dependencies */
import {Overlay, OverlayRef} from '@angular/cdk/overlay';
import {TemplatePortal} from '@angular/cdk/portal';
/* Native Dependencies */
import {EcashUnitChip} from '@client/modules/ecash/modules/ecash-general/types/ecash-general.types';

@Component({
	selector: 'orc-ecash-general-unit-picker',
	standalone: false,
	templateUrl: './ecash-general-unit-picker.component.html',
	styleUrl: './ecash-general-unit-picker.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EcashGeneralUnitPickerComponent implements OnDestroy {
	private readonly overlay = inject(Overlay);
	private readonly view_container_ref = inject(ViewContainerRef);

	public readonly chips = input.required<EcashUnitChip[]>();
	public readonly selected = input.required<string>();
	public readonly title = input<string>('Unit');
	public readonly caption = input<string | null>(null);
	public readonly disabled = input<boolean>(false);

	public readonly select = output<string>();

	public readonly is_open = signal<boolean>(false);

	private readonly panel_template = viewChild.required<TemplateRef<unknown>>('panel');

	private overlay_ref: OverlayRef | null = null;

	/* *******************************************************
		Actions Up
	******************************************************** */

	/** Slides the unit list up from the bottom of the screen, over the sheet */
	public onOpen(): void {
		if (this.overlay_ref) return;
		this.overlay_ref = this.overlay.create({
			positionStrategy: this.overlay.position().global().bottom('0').centerHorizontally(),
			width: '100%',
			hasBackdrop: true,
			backdropClass: 'cdk-overlay-dark-backdrop',
			scrollStrategy: this.overlay.scrollStrategies.block(),
		});
		this.overlay_ref.attach(new TemplatePortal(this.panel_template(), this.view_container_ref));
		this.overlay_ref.backdropClick().subscribe(() => this.close());
		this.overlay_ref.keydownEvents().subscribe((event) => {
			if (event.key === 'Escape') this.close();
		});
		this.is_open.set(true);
	}

	/** Picks a unit and closes the list */
	public onPick(unit: string): void {
		this.select.emit(unit);
		this.close();
	}

	/** Closes the list */
	private close(): void {
		this.overlay_ref?.dispose();
		this.overlay_ref = null;
		this.is_open.set(false);
	}

	/* *******************************************************
		Destroy
	******************************************************** */

	ngOnDestroy(): void {
		this.close();
	}
}
