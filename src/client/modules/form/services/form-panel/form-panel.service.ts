/* Core Dependencies */
import {DestroyRef, Injectable, Injector, Type, ViewContainerRef, inject, signal} from '@angular/core';
/* Vendor Dependencies */
import {Subject, Observable} from 'rxjs';
import {MatBottomSheet} from '@angular/material/bottom-sheet';
/* Native Dependencies */
import {FormPanelRef} from '@client/modules/form/services/form-panel/form-panel-ref';
import {FORM_PANEL_DATA, FormPanelConfig, FormPanelHostOptions} from '@client/modules/form/services/form-panel/form-panel.types';

/**
 * Service for opening form panels in a sidenav drawer, or a bottom sheet while the host asks for one.
 * Works like MatDialog — call open() with a component and config,
 * get back a FormPanelRef to listen for close events.
 */
@Injectable({providedIn: 'root'})
export class FormPanelService {
	private readonly bottomSheet = inject(MatBottomSheet);

	/** Whether the panel is currently open */
	public readonly opened = signal<boolean>(false);

	/** Emits when a panel is opened in the sidenav */
	private readonly _after_opened = new Subject<void>();

	/** Emits when a panel is closed */
	private readonly _after_closed = new Subject<void>();

	/** The current panel ref, if any */
	private _panel_ref: FormPanelRef | null = null;

	/** The ViewContainerRef provided by the host component */
	private _container: ViewContainerRef | null = null;

	/** How the host wants panels shown */
	private _host_options: FormPanelHostOptions = {};

	/** Observable that emits when the panel opens in the sidenav, so the host can show it */
	public afterOpened(): Observable<void> {
		return this._after_opened.asObservable();
	}

	/** Observable that emits when the panel closes */
	public afterClosed(): Observable<void> {
		return this._after_closed.asObservable();
	}

	/** Register the host container where panel components will be rendered; it unregisters itself when the host is destroyed */
	public registerContainer(container: ViewContainerRef, options: FormPanelHostOptions = {}): void {
		this._container = container;
		this._host_options = options;
		container.injector.get(DestroyRef).onDestroy(() => {
			if (this._container !== container) return;
			this._container = null;
			this._host_options = {};
		});
	}

	/**
	 * Open a form panel with the given component and config.
	 * @param component The component to render inside the panel
	 * @param config Optional config with data to inject
	 * @returns FormPanelRef to subscribe to close events
	 */
	public open<D = any, R = any>(component: Type<any>, config?: FormPanelConfig<D>): FormPanelRef<R> {
		if (!this._container) {
			throw new Error('FormPanelService: No container registered. Ensure a host component calls registerContainer().');
		}

		/* Close any existing panel first */
		if (this._panel_ref) {
			this._panel_ref.close();
		}
		this._container.clear();

		const panel_ref = new FormPanelRef<R>();
		this._panel_ref = panel_ref;

		/* Create the component with injected data and panel ref */
		const injector = Injector.create({
			providers: [
				{provide: FORM_PANEL_DATA, useValue: config?.data ?? null},
				{provide: FormPanelRef, useValue: panel_ref},
			],
			parent: this._container.injector,
		});

		this.opened.set(true);
		if (this._host_options.sheet?.()) {
			this.openSheet(component, injector, panel_ref);
		} else {
			this._container.createComponent(component, {injector});
			this._after_opened.next();
		}

		/* Auto-close when the panel ref emits */
		panel_ref.afterClosed().subscribe(() => {
			this._cleanup();
		});

		return panel_ref;
	}

	/** Render the panel in a bottom sheet; closing the ref dismisses the sheet, and dismissing the sheet closes the ref */
	private openSheet(component: Type<any>, injector: Injector, panel_ref: FormPanelRef): void {
		const sheet_ref = this.bottomSheet.open(component, {injector, autoFocus: false});
		sheet_ref.afterDismissed().subscribe(() => panel_ref.close());
		panel_ref.afterClosed().subscribe(() => sheet_ref.dismiss());
	}

	/** Close the currently open panel */
	public close(): void {
		if (this._panel_ref) {
			this._panel_ref.close();
		}
	}

	/** Clean up the container and reset state */
	private _cleanup(): void {
		this._container?.clear();
		this._panel_ref = null;
		this.opened.set(false);
		this._after_closed.next();
	}
}
