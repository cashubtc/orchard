/* Core Dependencies */
import {ChangeDetectionStrategy, Component, inject} from '@angular/core';

/* Vendor Dependencies */
import {MAT_DIALOG_DATA, MatDialogModule} from '@angular/material/dialog';
import {MatButtonModule} from '@angular/material/button';

/* Native Dependencies */
import {SERVICE_DESCRIPTORS} from '@client/modules/service-config/constants/service-config.constants';
import {serviceEndpoint, serviceEnvironmentPrefix} from '@client/modules/service-config/helpers/service-config.helpers';

/* Shared Dependencies */
import type {OrchardServiceConfiguration} from '@shared/generated.types';

@Component({
	selector: 'orc-service-remove-dialog',
	imports: [MatDialogModule, MatButtonModule],
	templateUrl: './service-remove-dialog.component.html',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceRemoveDialogComponent {
	public readonly configuration: OrchardServiceConfiguration = inject(MAT_DIALOG_DATA);
	public readonly descriptor = SERVICE_DESCRIPTORS[this.configuration.service];
	public readonly endpoint = serviceEndpoint(this.configuration);
	public readonly environment_prefix = serviceEnvironmentPrefix(this.configuration.service);
}
