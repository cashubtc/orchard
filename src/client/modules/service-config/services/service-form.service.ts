/* Core Dependencies */
import {DestroyRef, Injectable, inject, signal} from '@angular/core';
import {takeUntilDestroyed} from '@angular/core/rxjs-interop';

/* Vendor Dependencies */
import {EMPTY, catchError, finalize, tap, type Observable} from 'rxjs';

/* Application Dependencies */
import {OrchardErrors} from '@client/modules/error/classes/error.class';

/* Native Dependencies */
import {ServiceConfigService} from '@client/modules/service-config/services/service-config.service';
import {createServiceForm, serviceFormInput} from '@client/modules/service-config/helpers/service-config.helpers';
import type {ServiceForm} from '@client/modules/service-config/types/service-config.types';

/* Shared Dependencies */
import type {OrchardConnectionCheck, OrchardServiceConfiguration} from '@shared/generated.types';

@Injectable()
export class ServiceFormService {
	private readonly serviceConfigService = inject(ServiceConfigService);
	private readonly destroy_ref = inject(DestroyRef);

	public readonly result = signal<OrchardConnectionCheck | null>(null);
	public readonly busy = signal(false);
	public readonly error = signal<string | null>(null);
	public readonly saved = signal(false);

	private configuration!: OrchardServiceConfiguration;
	private form!: ServiceForm;

	/* *******************************************************
        Form lifecycle
    ******************************************************** */

	/** Start an isolated editor using the effective values and secret presence flags. */
	public initialize(configuration: OrchardServiceConfiguration): ServiceForm {
		this.configuration = configuration;
		this.form = createServiceForm(configuration);
		this.changed();
		return this.form;
	}

	/** Share test, save, explicit bypass, and busy-state handling across service forms. */
	public submit(save: boolean, save_unreachable = false): Observable<OrchardConnectionCheck> {
		if (this.busy()) return EMPTY;
		this.busy.set(true);
		this.error.set(null);
		const input = serviceFormInput(this.configuration, this.form);
		this.form.disable({emitEvent: false});
		const request = save ? this.serviceConfigService.save(input, save_unreachable) : this.serviceConfigService.test(input);
		return request.pipe(
			takeUntilDestroyed(this.destroy_ref),
			tap((result) => {
				this.result.set(result);
				this.saved.set(save && (result.ok || save_unreachable));
			}),
			catchError((error: unknown) => {
				this.error.set(
					(error instanceof OrchardErrors && error.errors[0]?.message) || 'The configuration request could not be completed.',
				);
				return EMPTY;
			}),
			finalize(() => {
				this.busy.set(false);
				this.form.enable({emitEvent: false});
			}),
		);
	}

	/** Editing invalidates the previous result and the save-without-connection offer. */
	public changed(): void {
		this.result.set(null);
		this.saved.set(false);
		this.error.set(null);
	}
}
