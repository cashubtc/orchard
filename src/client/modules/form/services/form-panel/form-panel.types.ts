/* Core Dependencies */
import {InjectionToken, Signal, Type} from '@angular/core';

/** Injection token for passing data into form panel components (like MAT_DIALOG_DATA) */
export const FORM_PANEL_DATA = new InjectionToken<any>('FORM_PANEL_DATA');

/** Configuration for opening a form panel */
export interface FormPanelConfig<D = any> {
	/** Data to inject into the component via FORM_PANEL_DATA */
	data?: D;
}

/** Options a section sets when it registers its panel host */
export interface FormPanelHostOptions {
	/** While true, panels open in a bottom sheet instead of the section's sidenav */
	sheet?: Signal<boolean>;
}

/** Internal state representing an active panel */
export interface FormPanelState<D = any> {
	/** The component to render inside the panel */
	component: Type<any>;
	/** Configuration including injected data */
	config: FormPanelConfig<D>;
}
