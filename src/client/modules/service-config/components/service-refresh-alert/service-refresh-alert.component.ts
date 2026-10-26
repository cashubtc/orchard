/* Core Dependencies */
import {ChangeDetectionStrategy, Component, computed, inject, input} from '@angular/core';

/* Vendor Dependencies */
import {MatButtonModule} from '@angular/material/button';

/* Native Dependencies */
import {ServiceConfigService} from '@client/modules/service-config/services/service-config.service';

/* Shared Dependencies */
import type {ServiceKind} from '@shared/generated.types';

@Component({
	selector: 'orc-service-refresh-alert',
	host: {'[class.hidden]': '!error()'},
	imports: [MatButtonModule],
	templateUrl: './service-refresh-alert.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceRefreshAlertComponent {
	private readonly serviceConfigService = inject(ServiceConfigService);

	public readonly service = input.required<ServiceKind>();
	public readonly disabled = input<boolean>(false);

	public readonly error = computed<string | null>(() => this.serviceConfigService.refresh_errors()[this.service()] ?? null);

	/* *******************************************************
		Actions Up
	******************************************************** */

	/** Retry only the status refresh; the alert hides while it runs. */
	public retry(): void {
		this.serviceConfigService.retry(this.service());
	}
}
