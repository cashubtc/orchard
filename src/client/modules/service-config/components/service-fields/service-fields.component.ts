/* Core Dependencies */
import {Component, ChangeDetectionStrategy, computed, effect, input, output, signal} from '@angular/core';
import {NgTemplateOutlet} from '@angular/common';
import {ReactiveFormsModule} from '@angular/forms';

/* Vendor Dependencies */
import type {ErrorStateMatcher} from '@angular/material/core';
import {MatFormFieldModule} from '@angular/material/form-field';
import {MatInputModule} from '@angular/material/input';
import {MatButtonModule} from '@angular/material/button';

/* Application Dependencies */
import {OrcFormModule} from '@client/modules/form/form.module';

/* Native Dependencies */
import type {ServiceForm, ServiceFieldState} from '@client/modules/service-config/types/service-config.types';
import {
	SERVICE_CREDENTIAL_CAPTIONS,
	SERVICE_DEFAULT_PORTS,
	SERVICE_DESCRIPTORS,
	SERVICE_FIELD_SPANS,
	SERVICE_TRANSPORTS,
} from '@client/modules/service-config/constants/service-config.constants';
import {visibleServiceFields} from '@client/modules/service-config/helpers/service-config.helpers';

/* Shared Dependencies */
import type {OrchardServiceConfiguration} from '@shared/generated.types';

@Component({
	selector: 'orc-service-fields',
	imports: [NgTemplateOutlet, ReactiveFormsModule, MatFormFieldModule, MatInputModule, MatButtonModule, OrcFormModule],
	templateUrl: './service-fields.component.html',
	styleUrl: './service-fields.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceFieldsComponent {
	public readonly error_matcher: ErrorStateMatcher = {
		isErrorState: (control) => this.flagged().some((key) => this.form().controls[key] === control),
	};
	public readonly descriptors = SERVICE_DESCRIPTORS;
	public readonly transports = SERVICE_TRANSPORTS;

	public readonly configuration = input.required<OrchardServiceConfiguration>();
	public readonly form = input.required<ServiceForm>();
	public readonly flagged = input<string[]>([]);
	public readonly changed = output<void>();
	public readonly focused = signal<string | null>(null);

	public readonly fields = computed<ServiceFieldState[]>(() => {
		this.form_revision();
		const configuration = this.configuration();
		const form = this.form();
		const visible = visibleServiceFields(configuration.service, form.controls['type'].value, form.controls['mtls']?.value ?? 'false');
		const last_credential = visible.filter((field) => field.credential || field.password).at(-1)?.key;
		const three_files = visible.some((field) => field.key === 'ca');
		return visible
			.filter((field) => !!form.controls[field.key])
			.map((field) => {
				const control = form.controls[field.key];
				const saved = configuration.fields.find((item) => item.key === field.key);
				const stored = !!saved?.set && !control.dirty;
				return {
					...field,
					stored,
					cleared: !!saved?.set && control.dirty && !control.value,
					placeholder:
						saved?.secret && stored
							? '•••••••• (unchanged)'
							: (field.placeholder ?? (field.credential ? 'File path or pasted content' : '')),
					hot: control.dirty || this.focused() === field.key,
					flagged: this.flagged().includes(field.key),
					credential_caption: field.key === last_credential,
					span: field.key === 'cert' && three_files ? 4 : (SERVICE_FIELD_SPANS[field.key] ?? 12),
				};
			});
	});
	public readonly connection_fields = computed<ServiceFieldState[]>(() => this.fields().filter((field) => !field.optional));
	public readonly optional_fields = computed<ServiceFieldState[]>(() => this.fields().filter((field) => field.optional));
	// Opens for a flagged or filled-in optional value; otherwise the operator expands it
	public readonly optional_open = computed<boolean>(() =>
		this.optional_fields().some((field) => field.flagged || field.stored || !!this.form().controls[field.key].value),
	);
	public readonly type_value = computed<string>(() => {
		this.form_revision();
		return this.form().controls['type'].value;
	});
	public readonly mtls_value = computed<string>(() => {
		this.form_revision();
		return this.form().controls['mtls']?.value ?? 'false';
	});
	public readonly credential_caption = computed<string>(() => {
		this.form_revision();
		return SERVICE_CREDENTIAL_CAPTIONS[this.form().controls['type'].value] ?? '';
	});

	private readonly form_revision = signal<number>(0);

	constructor() {
		effect((on_cleanup) => {
			const subscription = this.form().events.subscribe(() => this.form_revision.update((revision) => revision + 1));
			on_cleanup(() => subscription.unsubscribe());
		});
	}

	/* *******************************************************
		Form fields
	******************************************************** */

	/** Pick an implementation from the segmented control. */
	public setType(value: string): void {
		const control = this.form().controls['type'];
		if (this.form().disabled || control.value === value) return;
		control.setValue(value);
		control.markAsDirty();
		this.onTypeChange();
	}

	/** Pick the mint's transport; mutual TLS reveals the certificate fields. */
	public setTransport(value: string): void {
		const control = this.form().controls['mtls'];
		if (this.form().disabled || control.value === value) return;
		control.setValue(value);
		control.markAsDirty();
		this.changed.emit();
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

	/** Restore a field's effective value without submitting a masked credential. */
	public resetField(key: string): void {
		if (this.form().disabled) return;
		const field = this.configuration().fields.find((item) => item.key === key);
		this.form().controls[key].reset(field?.value ?? '');
		this.changed.emit();
	}

	/** Make clearing an unchanged credential explicit. */
	public clearField(key: string): void {
		if (this.form().disabled) return;
		this.form().controls[key].setValue('');
		this.form().controls[key].markAsDirty();
		this.changed.emit();
	}
}
