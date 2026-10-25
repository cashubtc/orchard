/* Core Dependencies */
import {Component, ChangeDetectionStrategy, input, output} from '@angular/core';
import {ReactiveFormsModule} from '@angular/forms';

/* Vendor Dependencies */
import type {ErrorStateMatcher} from '@angular/material/core';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatSelectModule} from '@angular/material/select';
import {MatButtonModule} from '@angular/material/button';

/* Native Dependencies */
import type {ServiceForm, ServiceField} from '@client/modules/service-config/types/service-config.types';
import {SERVICE_DEFAULT_PORTS, SERVICE_DESCRIPTORS} from '@client/modules/service-config/constants/service-config.constants';
import {visibleServiceFields} from '@client/modules/service-config/helpers/service-config.helpers';

/* Shared Dependencies */
import type {OrchardServiceConfiguration} from '@shared/generated.types';

@Component({
	selector: 'orc-service-fields',
	imports: [ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule],
	templateUrl: './service-fields.component.html',
	styleUrl: './service-fields.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceFieldsComponent {
	public readonly error_matcher: ErrorStateMatcher = {
		isErrorState: (control) => this.flagged().some((key) => this.form().controls[key] === control),
	};
	public readonly descriptors = SERVICE_DESCRIPTORS;
	public readonly configuration = input.required<OrchardServiceConfiguration>();
	public readonly form = input.required<ServiceForm>();
	public readonly flagged = input<string[]>([]);
	public readonly changed = output<void>();

	/* *******************************************************
        Form fields
    ******************************************************** */

	/** Include only fields supported by the chosen implementation. */
	public fields(): ServiceField[] {
		return visibleServiceFields(
			this.configuration().service,
			this.form().controls['type'].value,
			this.form().controls['mtls']?.value ?? 'false',
		);
	}

	/** A placeholder communicates presence without sending or resubmitting a secret. */
	public placeholder(field: ServiceField): string {
		const stored = this.configuration().fields.find((item) => item.key === field.key);
		return stored?.secret && stored.set
			? '•••••••• (unchanged)'
			: (field.placeholder ?? (field.credential ? 'File path or pasted content' : ''));
	}

	/** Clear incompatible credentials when switching between Lightning implementations. */
	public onTypeChange(): void {
		if (this.configuration().service === 'lightning') {
			for (const key of ['cert', 'key', 'ca', 'macaroon']) {
				this.form().controls[key].setValue('');
				this.form().controls[key].markAsDirty();
			}
			if (!this.form().controls['port'].dirty)
				this.form().controls['port'].setValue(SERVICE_DEFAULT_PORTS[this.form().controls['type'].value]);
		}
		this.changed.emit();
	}

	/** Make clearing an unchanged credential explicit. */
	public clearField(key: string): void {
		this.form().controls[key].setValue('');
		this.form().controls[key].markAsDirty();
		this.changed.emit();
	}
}
